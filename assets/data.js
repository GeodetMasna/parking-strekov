/* =============================================================
   Datová vrstva. Dvě implementace se stejným rozhraním:
     · Supabase   — ostrý provoz (config.SUPABASE_URL vyplněno)
     · Demo       — data v paměti, nic se neukládá
   Zbytek aplikace nepozná rozdíl.
   ============================================================= */

window.PARK = window.PARK || {};

window.PARK.data = (function () {
  var cfg = window.PARK.config;
  var util = window.PARK.util;
  var jeDemo = !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY;
  var sb = null;
  var posluchaci = [];

  if (!jeDemo) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    sb.auth.onAuthStateChange(function () { posluchaci.forEach(function (f) { f(); }); });
  }

  /* ---------------- DEMO DATA ---------------- */
  var demo = {
    uzivatel: null,
    mista: [
      { kod: 'P1', popis: 'Nejblíže vjezdu',   typ: 'AC 22 kW, Type 2', aktivni: true },
      { kod: 'P2', popis: 'Druhé od vjezdu',   typ: 'AC 22 kW, Type 2', aktivni: true },
      { kod: 'P3', popis: 'Třetí od vjezdu',   typ: 'AC 22 kW, Type 2', aktivni: true },
      { kod: 'P4', popis: 'Nejdále od vjezdu', typ: 'AC 22 kW, Type 2', aktivni: false }
    ],
    vozidla: [
      { id: 'v1', spz: '4AB 1234', model: 'Škoda Enyaq' },
      { id: 'v2', spz: '2UL 8890', model: 'VW ID.4' },
      { id: 'v3', spz: '5U9 4471', model: 'Škoda Superb iV' }
    ],
    rezervace: [],
    drzitele: [
      { email: 'kolega1@strabag.com', jmeno: 'Kolega Jedna', aktivni: true },
      { email: 'kolega2@strabag.com', jmeno: 'Kolega Dva',   aktivni: true }
    ]
  };

  // Ukázkové rezervace kolem dnešního dne, ať mřížka není prázdná
  (function naplnDemo() {
    var po = util.pondeli(util.dnes());
    function pridej(offset, misto, vozidlo) {
      demo.rezervace.push({
        id: 'r' + demo.rezervace.length,
        datum: util.pridej(po, offset),
        misto_kod: misto,
        vozidlo_id: vozidlo.id,
        spz: vozidlo.spz,
        ridic_email: 'ukazka@strabag.com',
        ridic_jmeno: 'Ukázkový řidič',
        stav: 'aktivni'
      });
    }
    pridej(0, 'P1', demo.vozidla[0]);
    pridej(1, 'P1', demo.vozidla[0]);
    pridej(1, 'P2', demo.vozidla[1]);
    pridej(3, 'P2', demo.vozidla[1]);
    pridej(4, 'P3', demo.vozidla[2]);
  })();

  /* ---------------- AUTENTIZACE ---------------- */

  function uzivatel() {
    if (jeDemo) return demo.uzivatel;
    var s = sb.auth.__session || null;
    return s;
  }

  /** Vrátí přihlášeného uživatele (asynchronně, kvůli Supabase). */
  function nactiUzivatele() {
    if (jeDemo) return Promise.resolve(demo.uzivatel);
    return sb.auth.getUser().then(function (res) {
      if (res.error || !res.data.user) return null;
      return { email: res.data.user.email };
    }).catch(function () { return null; });
  }

  /**
   * Přihlášení e-mailem a heslem. Účty zakládá správce v Supabase,
   * samoobslužná registrace je vypnutá.
   */
  function prihlas(email, heslo) {
    if (jeDemo) {
      demo.uzivatel = { email: email };
      posluchaci.forEach(function (f) { f(); });
      return Promise.resolve({ demo: true });
    }
    return sb.auth.signInWithPassword({ email: email, password: heslo })
      .then(function (res) {
        if (res.error) throw res.error;
        return { demo: false };
      });
  }

  /** Změna vlastního hesla přihlášeného uživatele. */
  function zmenHeslo(nove) {
    if (jeDemo) return Promise.resolve();
    return sb.auth.updateUser({ password: nove }).then(function (res) {
      if (res.error) throw res.error;
    });
  }

  function odhlas() {
    if (jeDemo) {
      demo.uzivatel = null;
      posluchaci.forEach(function (f) { f(); });
      return Promise.resolve();
    }
    return sb.auth.signOut();
  }

  function naZmenuPrihlaseni(cb) { posluchaci.push(cb); }

  /* ---------------- ČTENÍ ---------------- */

  function nactiMista() {
    if (jeDemo) return Promise.resolve(demo.mista.slice());
    return sb.from('v_mista').select('*').then(function (r) {
      if (r.error) throw r.error;
      return r.data.map(function (m) {
        return { kod: m.kod, popis: m.popis, typ: m.typ_nabijecky, aktivni: m.aktivni };
      });
    });
  }

  /**
   * Obsazenost v rozsahu dnů.
   * Nepřihlášený dostane jen datum + stání (veřejný pohled, bez SPZ).
   * Přihlášený řidič dostane navíc SPZ a e-mail držitele rezervace.
   */
  function nactiObsazenost(od, doDne, prihlasen) {
    if (jeDemo) {
      var out = demo.rezervace
        .filter(function (r) { return r.stav === 'aktivni' && r.datum >= od && r.datum <= doDne; })
        .map(function (r) {
          return prihlasen ? r : { datum: r.datum, misto_kod: r.misto_kod };
        });
      return Promise.resolve(out);
    }
    if (!prihlasen) {
      return sb.from('v_obsazenost').select('datum,misto_kod')
        .gte('datum', od).lte('datum', doDne)
        .then(function (r) { if (r.error) throw r.error; return r.data; });
    }
    return sb.from('rezervace')
      .select('id,datum,misto_kod,stav,ridic_email,vozidla(spz,model)')
      .eq('stav', 'aktivni').gte('datum', od).lte('datum', doDne)
      .then(function (r) {
        if (r.error) throw r.error;
        return r.data.map(function (x) {
          return {
            id: x.id, datum: x.datum, misto_kod: x.misto_kod,
            ridic_email: x.ridic_email,
            spz: x.vozidla ? x.vozidla.spz : null
          };
        });
      });
  }

  /** Adresáti upozornění — jen pro přihlášeného řidiče. */
  function nactiDrziteleCipu() {
    if (jeDemo) return Promise.resolve(demo.drzitele.slice());
    return sb.from('drzitele_cipu').select('email,jmeno,aktivni').eq('aktivni', true)
      .then(function (r) {
        if (r.error) { console.warn('Seznam držitelů chipu se nenačetl:', r.error); return []; }
        return r.data;
      });
  }

  function nactiVozidla() {
    if (jeDemo) return Promise.resolve(demo.vozidla.slice());
    return sb.from('vozidla').select('id,spz,model').eq('aktivni', true).order('spz')
      .then(function (r) { if (r.error) throw r.error; return r.data; });
  }

  /* ---------------- ZÁPIS ---------------- */

  function vytvorRezervaci(datum, mistoKod, vozidloId, email) {
    if (jeDemo) {
      var kolize = demo.rezervace.some(function (r) {
        return r.stav === 'aktivni' && r.datum === datum && r.misto_kod === mistoKod;
      });
      if (kolize) return Promise.reject({ code: '23505' });
      var voz = demo.vozidla.filter(function (v) { return v.id === vozidloId; })[0];
      demo.rezervace.push({
        id: 'r' + Date.now(), datum: datum, misto_kod: mistoKod,
        vozidlo_id: vozidloId, spz: voz ? voz.spz : '', ridic_email: email,
        stav: 'aktivni'
      });
      return Promise.resolve();
    }
    return sb.from('rezervace').insert({
      datum: datum, misto_kod: mistoKod, vozidlo_id: vozidloId,
      ridic_email: email, stav: 'aktivni'
    }).then(function (r) { if (r.error) throw r.error; });
  }

  function zrusRezervaci(id) {
    if (jeDemo) {
      demo.rezervace.forEach(function (r) { if (r.id === id) r.stav = 'zrusena'; });
      return Promise.resolve();
    }
    return sb.from('rezervace').update({ stav: 'zrusena' }).eq('id', id)
      .then(function (r) { if (r.error) throw r.error; });
  }

  return {
    jeDemo: jeDemo,
    uzivatel: uzivatel,
    nactiUzivatele: nactiUzivatele,
    prihlas: prihlas,
    zmenHeslo: zmenHeslo,
    odhlas: odhlas,
    naZmenuPrihlaseni: naZmenuPrihlaseni,
    nactiMista: nactiMista,
    nactiObsazenost: nactiObsazenost,
    nactiVozidla: nactiVozidla,
    nactiDrziteleCipu: nactiDrziteleCipu,
    vytvorRezervaci: vytvorRezervaci,
    zrusRezervaci: zrusRezervaci
  };
})();

/* =============================================================
   Propojení všeho dohromady: načtení dat, události, překreslení.
   ============================================================= */

(function () {
  var cfg = window.PARK.config;
  var util = window.PARK.util;
  var data = window.PARK.data;
  var ui = window.PARK.ui;

  var stav = {
    uzivatel: null,
    mista: [],
    vozidla: [],
    rezervace: [],
    pondeli: util.pondeli(util.dnes())
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- Načtení a překreslení ---------------- */

  function nacti() {
    var dny = util.tyden(stav.pondeli);
    var od = util.pridej(dny[0], -1);
    var doDne = util.pridej(dny[6], 1);
    var prihlasen = !!stav.uzivatel;

    return Promise.all([
      data.nactiMista(),
      data.nactiObsazenost(od, doDne, prihlasen),
      prihlasen ? data.nactiVozidla() : Promise.resolve([])
    ]).then(function (v) {
      stav.mista = v[0];
      stav.rezervace = v[1];
      stav.vozidla = v[2];
      vykresli();
    }).catch(function (e) {
      console.error(e);
      hlaska($('msgRezervace'), 'Data se nepodařilo načíst: ' + (e.message || e), 'err');
    });
  }

  function vykresli() {
    var dnesek = util.dnes();
    var dny = util.tyden(stav.pondeli);

    $('todayDate').textContent = util.dlouhyDen(dnesek);
    ui.dlazdice($('tiles'), stav.mista, stav.rezervace, dnesek);

    var v = ui.verdikt(stav.mista, stav.rezervace, dnesek);
    var vEl = $('todayVerdict');
    vEl.textContent = v.text;
    vEl.className = 'today-verdict verdict--' + v.typ;

    $('weekRange').textContent = util.rozsahTydne(dny) + ' · týden ' + util.cisloTydne(dny[0]);
    $('boardHint').hidden = !stav.uzivatel;
    ui.mrizka($('grid'), dny, stav.mista, stav.rezervace, {
      email: stav.uzivatel ? stav.uzivatel.email : null,
      vikendy: cfg.POVOLIT_VIKENDY,
      onKlik: stav.uzivatel ? klikNaBunku : null
    });

    vykresliAuth();
    if (stav.uzivatel) {
      naplnVybery();
      ui.mojeRezervace($('mojeRezervace'), stav.rezervace, stav.uzivatel.email, zrus);
    }
  }

  function vykresliAuth() {
    var box = $('auth');
    box.innerHTML = '';
    if (stav.uzivatel) {
      var jm = document.createElement('span');
      jm.className = 'auth-user';
      jm.textContent = stav.uzivatel.email;
      box.appendChild(jm);

      if (!data.jeDemo) {
        var h = document.createElement('button');
        h.className = 'btn btn-ghost';
        h.type = 'button';
        h.textContent = 'Změnit heslo';
        h.addEventListener('click', function () { $('dlgHeslo').showModal(); });
        box.appendChild(h);
      }

      var b = document.createElement('button');
      b.className = 'btn btn-ghost';
      b.type = 'button';
      b.textContent = 'Odhlásit';
      b.addEventListener('click', function () {
        data.odhlas().then(function () { stav.uzivatel = null; nacti(); });
      });
      box.appendChild(b);
      $('panelRezervace').hidden = false;
    } else {
      var p = document.createElement('button');
      p.className = 'btn btn-ghost';
      p.id = 'btnPrihlasit';   // stejné id jako v HTML, ať na něj jde odkázat i po překreslení
      p.type = 'button';
      p.textContent = 'Přihlásit se';
      p.addEventListener('click', function () { $('dlgLogin').showModal(); });
      box.appendChild(p);
      $('panelRezervace').hidden = true;
    }
  }

  function naplnVybery() {
    var sv = $('selVozidlo');
    if (sv.options.length !== stav.vozidla.length) {
      sv.innerHTML = '';
      stav.vozidla.forEach(function (v) {
        var o = document.createElement('option');
        o.value = v.id;
        o.textContent = v.spz + (v.model ? ' — ' + v.model : '');
        sv.appendChild(o);
      });
    }
    var sm = $('selMisto');
    var aktivni = stav.mista.filter(function (m) { return m.aktivni; });
    if (sm.options.length !== aktivni.length) {
      sm.innerHTML = '';
      aktivni.forEach(function (m) {
        var o = document.createElement('option');
        o.value = m.kod;
        o.textContent = m.kod + (m.popis ? ' — ' + m.popis : '');
        sm.appendChild(o);
      });
    }
    var inp = $('inpDatum');
    inp.min = util.dnes();
    inp.max = util.pridej(util.dnes(), cfg.HORIZONT_DNU);
    if (!inp.value) inp.value = util.dnes();
  }

  function hlaska(el, text, typ) {
    el.textContent = text;
    el.className = 'msg' + (typ ? ' msg--' + typ : '');
  }

  /* ---------------- Akce ---------------- */

  /** Formulář — sestaví seznam dnů a předá je společné rezervační funkci. */
  function rezervuj(e) {
    e.preventDefault();
    var odDne = $('inpDatum').value;
    if (!odDne) return;
    var pocet = Number($('selRozsah').value);

    // Víkendy se přeskočí, pokud nejsou povolené
    var dny = [], d = odDne, pridano = 0, pojistka = 0;
    while (pridano < pocet && pojistka < 30) {
      if (cfg.POVOLIT_VIKENDY || !util.jeVikend(d)) { dny.push(d); pridano++; }
      d = util.pridej(d, 1);
      pojistka++;
    }
    rezervujDny(dny, $('selMisto').value, $('selVozidlo').value);
  }

  /** Klik do mřížky: volné stání rezervuje, vlastní rezervaci ruší. */
  function klikNaBunku(mistoKod, datum, mojeRezervace) {
    if (!stav.uzivatel) return;

    if (mojeRezervace) {
      if (window.confirm('Zrušit rezervaci stání ' + mistoKod + ' na ' + util.dlouhyDen(datum) + '?')) {
        zrus(mojeRezervace.id);
      }
      return;
    }

    var vozidloId = $('selVozidlo').value;
    if (!vozidloId) {
      hlaska($('msgRezervace'), 'Nejdřív vyberte vozidlo v panelu níže.', 'err');
      return;
    }
    // Formulář se srovná s tím, na co se kliklo — je pak vidět kontext
    $('selMisto').value = mistoKod;
    $('inpDatum').value = datum;
    rezervujDny([datum], mistoKod, vozidloId);
  }

  /** Uloží rezervace na zadané dny. Používá formulář i klik do mřížky. */
  function rezervujDny(dny, mistoKod, vozidloId) {
    if (!dny.length) return;

    var vozidlo = stav.vozidla.filter(function (v) { return v.id === vozidloId; })[0];
    var spz = vozidlo ? vozidlo.spz : '';

    // Limit počtu aktivních budoucích rezervací
    var mych = stav.rezervace.filter(function (r) {
      return r.ridic_email === stav.uzivatel.email && r.datum >= util.dnes();
    }).length;
    if (mych + dny.length > cfg.MAX_REZERVACI_NA_OSOBU) {
      hlaska($('msgRezervace'),
        'Limit je ' + cfg.MAX_REZERVACI_NA_OSOBU + ' aktivních rezervací a máte jich ' + mych +
        '. Nejdřív některou zrušte.', 'err');
      return;
    }

    hlaska($('msgRezervace'), 'Ukládám…', '');
    var vysledek = { ok: 0, obsazeno: [], ulozene: [] };

    dny.reduce(function (retez, den) {
      return retez.then(function () {
        return data.vytvorRezervaci(den, mistoKod, vozidloId, stav.uzivatel.email)
          .then(function () { vysledek.ok++; vysledek.ulozene.push(den); })
          .catch(function (err) {
            // 23505 = porušení unikátního indexu, tedy obsazeno
            if (err && (err.code === '23505' || String(err.message || '').indexOf('duplicate') > -1)) {
              vysledek.obsazeno.push(den);
            } else { throw err; }
          });
      });
    }, Promise.resolve())
      .then(function () {
        var obsazene = vysledek.obsazeno.map(util.denMesic).join(', ');
        var vozem = spz ? ' pro ' + spz : '';
        var t, typ;
        if (vysledek.ok === 0) {
          t = 'Stání ' + mistoKod + ' je už rezervované: ' + obsazene + ' Vyberte jiné stání nebo den.';
          typ = 'err';
        } else if (vysledek.obsazeno.length) {
          t = 'Zarezervováno stání ' + mistoKod + vozem + ' na ' + vysledek.ok + ' ' +
              sklonuj(vysledek.ok) + '. Obsazeno už bylo: ' + obsazene;
          typ = 'warn';
        } else if (vysledek.ok === 1) {
          t = 'Zarezervováno: ' + mistoKod + ', ' + util.dlouhyDen(vysledek.ulozene[0]) + vozem + '.';
          typ = 'ok';
        } else {
          t = 'Zarezervováno stání ' + mistoKod + vozem + ' na ' + vysledek.ok + ' ' +
              sklonuj(vysledek.ok) + '.';
          typ = 'ok';
        }
        hlaska($('msgRezervace'), t, typ);
        return nacti().then(function () { return upozorni(vysledek.ulozene, mistoKod, t, typ); });
      })
      .catch(function (err) {
        console.error(err);
        hlaska($('msgRezervace'), 'Rezervaci se nepodařilo uložit: ' + (err.message || err), 'err');
      });
  }

  /**
   * Upozorní držitele chipu na nové rezervace a doplní výsledek do hlášky.
   * Selhání mailu nikdy neruší rezervaci — ta je už uložená.
   */
  function upozorni(ulozene, mistoKod, textHlasky, typ) {
    if (!ulozene.length || !window.PARK.notify.jeNastaveno()) return;
    return data.nactiDrziteleCipu().then(function (drzitele) {
      return window.PARK.notify.novaRezervace(ulozene, mistoKod, drzitele);
    }).then(function (v) {
      if (!v) return;
      if (v.odeslano) {
        hlaska($('msgRezervace'), textHlasky + ' Upozornění odesláno držitelům chipu (' + v.odeslano + ').', typ);
      } else if (v.chyba) {
        hlaska($('msgRezervace'),
          textHlasky + ' Rezervace platí, ale upozornění se nepodařilo odeslat — dejte kolegům vědět jinak.', 'warn');
      }
    }).catch(function (e) { console.warn(e); });
  }

  function sklonuj(n) {
    if (n === 1) return 'den';
    if (n >= 2 && n <= 4) return 'dny';
    return 'dnů';
  }

  function zrus(id) {
    data.zrusRezervaci(id).then(function () {
      hlaska($('msgRezervace'), 'Rezervace zrušena, stání je uvolněno.', 'ok');
      return nacti();
    }).catch(function (e) {
      hlaska($('msgRezervace'), 'Zrušení se nepodařilo: ' + (e.message || e), 'err');
    });
  }

  function odesliPrihlaseni() {
    var email = $('inpEmail').value.trim().toLowerCase();
    var heslo = $('inpHeslo').value;
    if (!email || email.indexOf('@') < 0) {
      hlaska($('msgLogin'), 'Zadejte prosím platný e-mail.', 'err');
      return;
    }
    if (!heslo) {
      hlaska($('msgLogin'), 'Zadejte heslo, které vám přidělil správce.', 'err');
      return;
    }
    hlaska($('msgLogin'), 'Přihlašuji…', '');
    data.prihlas(email, heslo).then(function () {
      $('inpHeslo').value = '';
      $('dlgLogin').close();
      hlaska($('msgLogin'), '', '');
      return data.nactiUzivatele().then(function (u) { stav.uzivatel = u; return nacti(); });
    }).catch(function (e) {
      hlaska($('msgLogin'), popisChybyPrihlaseni(e), 'err');
    });
  }

  /** Chyby ze Supabase přeloží do věty, která uživateli něco řekne. */
  function popisChybyPrihlaseni(e) {
    var t = String((e && (e.message || e.error_description)) || '');
    if (t.indexOf('Invalid login credentials') > -1) {
      return 'Nesprávný e-mail nebo heslo. Zkuste to znovu, nebo se ozvěte správci parkoviště.';
    }
    if (t.indexOf('Email not confirmed') > -1) {
      return 'Účet ještě není potvrzený — dejte vědět správci parkoviště.';
    }
    if (t.indexOf('rate limit') > -1 || t.indexOf('Too many') > -1) {
      return 'Příliš mnoho pokusů za sebou. Zkuste to za chvíli.';
    }
    return 'Přihlášení selhalo: ' + (t || 'neznámá chyba');
  }

  function ulozNoveHeslo() {
    var a = $('inpNoveHeslo').value, b = $('inpNoveHeslo2').value;
    if (a.length < 8) {
      hlaska($('msgHeslo'), 'Heslo musí mít aspoň 8 znaků.', 'err'); return;
    }
    if (a !== b) {
      hlaska($('msgHeslo'), 'Hesla se neshodují.', 'err'); return;
    }
    hlaska($('msgHeslo'), 'Ukládám…', '');
    data.zmenHeslo(a).then(function () {
      $('inpNoveHeslo').value = ''; $('inpNoveHeslo2').value = '';
      hlaska($('msgHeslo'), '', '');
      $('dlgHeslo').close();
      hlaska($('msgRezervace'), 'Heslo bylo změněno.', 'ok');
    }).catch(function (e) {
      hlaska($('msgHeslo'), 'Heslo se nepodařilo změnit: ' + (e.message || e), 'err');
    });
  }

  /* ---------------- Start ---------------- */

  function naEnter(idcka, akce) {
    idcka.forEach(function (id) {
      $(id).addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); akce(); }
      });
    });
  }

  function start() {
    $('btnPrev').addEventListener('click', function () {
      stav.pondeli = util.pridej(stav.pondeli, -7); vykresli(); nacti();
    });
    $('btnNext').addEventListener('click', function () {
      stav.pondeli = util.pridej(stav.pondeli, 7); vykresli(); nacti();
    });
    $('btnToday').addEventListener('click', function () {
      stav.pondeli = util.pondeli(util.dnes()); vykresli(); nacti();
    });
    $('formRezervace').addEventListener('submit', rezervuj);
    $('btnOdeslat').addEventListener('click', odesliPrihlaseni);
    $('btnUlozHeslo').addEventListener('click', ulozNoveHeslo);
    $('btnPrihlasit').addEventListener('click', function () { $('dlgLogin').showModal(); });

    // Enter v poli dialogu potvrdí akci místo zavření dialogu
    naEnter(['inpEmail', 'inpHeslo'], odesliPrihlaseni);
    naEnter(['inpNoveHeslo', 'inpNoveHeslo2'], ulozNoveHeslo);

    $('footMode').textContent = data.jeDemo
      ? 'Demo režim — data jsou pouze ukázková a neukládají se'
      : 'Připojeno k Supabase';

    data.naZmenuPrihlaseni(function () {
      data.nactiUzivatele().then(function (u) { stav.uzivatel = u; nacti(); });
    });

    data.nactiUzivatele().then(function (u) {
      stav.uzivatel = u;
      return nacti();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else { start(); }
})();

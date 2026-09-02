/* =============================================================
   Vykreslování. Žádná komunikace se serverem — jen DOM.
   ============================================================= */

window.PARK = window.PARK || {};

window.PARK.ui = (function () {
  var util = window.PARK.util;

  /** Najde aktivní rezervaci pro stání a den. */
  function rezervaceProDen(rezervace, mistoKod, datum) {
    for (var i = 0; i < rezervace.length; i++) {
      if (rezervace[i].misto_kod === mistoKod && rezervace[i].datum === datum) return rezervace[i];
    }
    return null;
  }

  /** Stav jedné buňky: 'off' | 'res' | 'free'. */
  function stav(misto, rezervace, datum) {
    if (!misto.aktivni) return 'off';
    return rezervaceProDen(rezervace, misto.kod, datum) ? 'res' : 'free';
  }

  function el(tag, trida, text) {
    var e = document.createElement(tag);
    if (trida) e.className = trida;
    if (text != null) e.textContent = text;
    return e;
  }

  /** Popisek stavu buňky. Na úzkých displejích zkrácený, ať se vejde. */
  function popisStavu(s, moje, vikend, uzky) {
    if (s === 'off') return uzky ? 'Mimo' : 'Mimo provoz';
    if (s === 'res') return moje ? (uzky ? 'Moje' : 'Moje rezervace')
                                 : (uzky ? 'Rez.' : 'Rezervováno');
    return vikend ? 'Víkend' : (uzky ? 'Volno' : 'Volné');
  }

  /* ---------- Dlaždice pro dnešek ---------- */
  function dlazdice(kontejner, mista, rezervace, datum, uzky) {
    kontejner.innerHTML = '';
    mista.forEach(function (m) {
      var s = stav(m, rezervace, datum);
      var r = rezervaceProDen(rezervace, m.kod, datum);
      var karta = el('div', 'tile tile--' + s);
      karta.setAttribute('role', 'listitem');

      karta.appendChild(el('div', 'tile-kod', m.kod));
      karta.appendChild(el('div', 'tile-stav', popisStavu(s, false, false, uzky)));

      // Na úzkém displeji se vypisuje jen SPZ u rezervovaných —
      // vysvětlující text říká totéž co závěr nad dlaždicemi.
      var detail = s === 'off'
        ? (uzky ? '' : (m.popis || ''))
        : (s === 'res'
            ? (r && r.spz ? r.spz : 'firemní elektromobil')
            : (uzky ? '' : 'spalovací vůz smí stát'));
      if (detail) karta.appendChild(el('div', 'tile-detail', detail));
      kontejner.appendChild(karta);
    });
  }

  /** Jednořádkový závěr nad dlaždicemi — co z toho plyne pro řidiče u závory. */
  function verdikt(mista, rezervace, datum) {
    // Stání mimo provoz se do závěru nepočítají — nejsou k dispozici nikomu.
    var provozni = mista.filter(function (m) { return m.aktivni; });
    var volna = provozni.filter(function (m) { return stav(m, rezervace, datum) === 'free'; });
    var obsazena = provozni.filter(function (m) { return stav(m, rezervace, datum) === 'res'; });

    function kody(pole) { return pole.map(function (m) { return m.kod; }).join(', '); }

    if (provozni.length === 0) {
      return { text: 'Všechna stání jsou dnes mimo provoz.', typ: 'stop' };
    }
    if (volna.length === 0) {
      return { text: 'Dnes je rezervované každé provozní stání — vozidlem se spalovacím motorem sem nevjíždějte.', typ: 'stop' };
    }
    if (obsazena.length === 0) {
      return { text: 'Dnes není žádná rezervace. Volná stání: ' + kody(volna) + '.', typ: 'ok' };
    }
    return {
      text: 'Volná stání pro spalovací vozy dnes: ' + kody(volna) +
            '. Rezervováno je ' + kody(obsazena) + ' — tam nevjíždějte.',
      typ: 'warn'
    };
  }

  /* ----------------------------------------------------------
     Týdenní mřížka.
     opts (nepovinné):
       email        e-mail přihlášeného — jeho rezervace se odliší
       vikendy      lze rezervovat i o víkendu?
       onKlik(mistoKod, datum, rezervaceNeboNull)
                    když je předán, volné buňky a vlastní rezervace
                    se stanou klikatelnými
     ---------------------------------------------------------- */
  function mrizka(kontejner, dny, mista, rezervace, opts) {
    opts = opts || {};
    kontejner.innerHTML = '';
    var dnesek = util.dnes();
    var uzky = !!opts.uzky;

    // Na úzkém displeji se mřížka otočí: dny jdou po řádcích a stání
    // po sloupcích. Celý týden se pak vejde bez vodorovného posouvání.
    kontejner.classList.toggle('grid--otocena', uzky);

    /** Jedna buňka průsečíku stání × den. */
    function bunkaPro(m, d) {
      var s = stav(m, rezervace, d);
      var vikend = util.jeVikend(d);
      var r = rezervaceProDen(rezervace, m.kod, d);
      var moje = !!(r && opts.email && r.ridic_email === opts.email);

      var bunka = el('div', 'cell cell--' + (vikend && s === 'free' ? 'wknd' : s));
      if (d === dnesek) bunka.classList.add('cell--today');
      if (moje) bunka.classList.add('cell--moje');

      bunka.appendChild(el('b', null, popisStavu(s, moje, vikend, uzky)));
      if (r && r.spz) bunka.appendChild(el('small', null, r.spz));

      // Klikat lze na volné stání a na vlastní rezervaci (ta se klikem ruší).
      // Ne do minulosti, ne na stání mimo provoz, ne o víkendu, když je vypnutý.
      var lzeKliknout = !!opts.onKlik && s !== 'off' && d >= dnesek
                        && (opts.vikendy || !vikend)
                        && (s === 'free' || moje);

      if (lzeKliknout) {
        bunka.classList.add('cell--klik');
        bunka.setAttribute('role', 'button');
        bunka.tabIndex = 0;
        var akce = function () { opts.onKlik(m.kod, d, moje ? r : null); };
        bunka.addEventListener('click', akce);
        bunka.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); akce(); }
        });
        bunka.title = moje ? 'Kliknutím rezervaci zrušíte'
                           : 'Kliknutím stání rezervujete';
      }

      bunka.setAttribute('aria-label',
        m.kod + ' ' + util.kratkyDen(d) + ': ' + popisStavu(s, moje, vikend, false) +
        (lzeKliknout ? (moje ? ' — kliknutím zrušíte' : ' — kliknutím rezervujete') : ''));
      return bunka;
    }

    if (uzky) {
      // Hlavička: rohová buňka + kódy stání
      kontejner.appendChild(el('div', 'g-hd g-corner', 'Den'));
      mista.forEach(function (m) {
        var h = el('div', 'g-hd', m.kod);
        h.title = (m.popis || '') + (m.typ ? ' · ' + m.typ : '');
        kontejner.appendChild(h);
      });
      dny.forEach(function (d) {
        var lbl = el('div', 'g-row' + (d === dnesek ? ' g-dnes' : ''), util.kratkyDen(d));
        kontejner.appendChild(lbl);
        mista.forEach(function (m) { kontejner.appendChild(bunkaPro(m, d)); });
      });
      return;
    }

    kontejner.appendChild(el('div', 'g-hd g-corner', 'Stání'));
    dny.forEach(function (d) {
      kontejner.appendChild(el('div', 'g-hd' + (d === dnesek ? ' g-dnes' : ''), util.kratkyDen(d)));
    });
    mista.forEach(function (m) {
      var lbl = el('div', 'g-row', m.kod);
      lbl.title = (m.popis || '') + (m.typ ? ' · ' + m.typ : '');
      kontejner.appendChild(lbl);
      dny.forEach(function (d) { kontejner.appendChild(bunkaPro(m, d)); });
    });
  }

  /* ---------- Moje rezervace ---------- */
  function mojeRezervace(kontejner, rezervace, email, onZrus) {
    kontejner.innerHTML = '';
    var moje = rezervace.filter(function (r) {
      return r.ridic_email === email && r.datum >= util.dnes();
    }).sort(function (a, b) { return a.datum < b.datum ? -1 : 1; });

    if (moje.length === 0) {
      kontejner.appendChild(el('p', 'empty', 'Zatím nemáte žádnou budoucí rezervaci.'));
      return;
    }

    moje.forEach(function (r) {
      var radek = el('div', 'mine-row');
      var levy = el('div', 'mine-info');
      levy.appendChild(el('span', 'mine-datum', util.dlouhyDen(r.datum)));
      levy.appendChild(el('span', 'mine-detail', r.misto_kod + (r.spz ? ' · ' + r.spz : '')));
      radek.appendChild(levy);

      var btn = el('button', 'btn btn-ghost btn-sm', 'Zrušit');
      btn.type = 'button';
      btn.addEventListener('click', function () { onZrus(r.id); });
      radek.appendChild(btn);

      kontejner.appendChild(radek);
    });
  }

  return {
    dlazdice: dlazdice,
    verdikt: verdikt,
    mrizka: mrizka,
    mojeRezervace: mojeRezervace
  };
})();

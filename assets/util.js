/* =============================================================
   Pomocné funkce — práce s daty jako s textem 'YYYY-MM-DD'.
   Záměrně se vyhýbáme objektu Date u ukládání, aby nemohlo
   dojít k posunu o den kvůli časovému pásmu.
   ============================================================= */

window.PARK = window.PARK || {};

window.PARK.util = (function () {

  var DNY = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
  var MESICE = ['ledna', 'února', 'března', 'dubna', 'května', 'června',
                'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];

  /** Dnešní datum jako 'YYYY-MM-DD' v místním čase. */
  function dnes() {
    return iso(new Date());
  }

  /** Objekt Date → 'YYYY-MM-DD' (místní čas, bez UTC posunu). */
  function iso(d) {
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var den = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + den;
  }

  /** 'YYYY-MM-DD' → objekt Date v poledne (bezpečné vůči pásmům). */
  function naDate(s) {
    var c = s.split('-');
    return new Date(Number(c[0]), Number(c[1]) - 1, Number(c[2]), 12, 0, 0);
  }

  /** Přičte (nebo odečte) dny k datu ve formátu 'YYYY-MM-DD'. */
  function pridej(s, pocet) {
    var d = naDate(s);
    d.setDate(d.getDate() + pocet);
    return iso(d);
  }

  /** Pondělí týdne, do kterého datum spadá. */
  function pondeli(s) {
    var d = naDate(s);
    var posun = (d.getDay() + 6) % 7;   // Po = 0, Ne = 6
    d.setDate(d.getDate() - posun);
    return iso(d);
  }

  /** Sedm dnů týdne počínaje pondělím. */
  function tyden(pondeliIso) {
    var out = [];
    for (var i = 0; i < 7; i++) out.push(pridej(pondeliIso, i));
    return out;
  }

  /** Je datum sobota nebo neděle? */
  function jeVikend(s) {
    var den = naDate(s).getDay();
    return den === 0 || den === 6;
  }

  /** 'Po 7.' — krátký popisek do hlavičky mřížky. */
  function kratkyDen(s) {
    var d = naDate(s);
    return DNY[d.getDay()] + ' ' + d.getDate() + '.';
  }

  /** '2. 9.' — krátký datum do výčtu dnů. */
  function denMesic(s) {
    var d = naDate(s);
    return d.getDate() + '. ' + (d.getMonth() + 1) + '.';
  }

  /** 'středa 2. září 2026' — dlouhý formát pro panel Dnes. */
  function dlouhyDen(s) {
    var d = naDate(s);
    var nazvy = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
    return nazvy[d.getDay()] + ' ' + d.getDate() + '. ' + MESICE[d.getMonth()] + ' ' + d.getFullYear();
  }

  /** '7.–13. 9. 2026', na přelomu měsíce '31. 8. – 6. 9. 2026'. */
  function rozsahTydne(dny) {
    var a = naDate(dny[0]), b = naDate(dny[6]);
    if (a.getMonth() === b.getMonth()) {
      return a.getDate() + '.–' + b.getDate() + '. ' + (b.getMonth() + 1) + '. ' + b.getFullYear();
    }
    return a.getDate() + '. ' + (a.getMonth() + 1) + '. – ' +
           b.getDate() + '. ' + (b.getMonth() + 1) + '. ' + b.getFullYear();
  }

  /** Číslo ISO týdne — jen pro popisek. */
  function cisloTydne(s) {
    var d = naDate(s);
    var ctvrtek = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7));
    var prvni = new Date(ctvrtek.getFullYear(), 0, 4);
    return 1 + Math.round(((ctvrtek - prvni) / 86400000 - 3 + ((prvni.getDay() + 6) % 7)) / 7);
  }

  return {
    dnes: dnes, iso: iso, naDate: naDate, pridej: pridej,
    pondeli: pondeli, tyden: tyden, jeVikend: jeVikend,
    kratkyDen: kratkyDen, denMesic: denMesic, dlouhyDen: dlouhyDen,
    rozsahTydne: rozsahTydne, cisloTydne: cisloTydne
  };
})();

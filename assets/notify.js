/* =============================================================
   Odeslání upozornění držitelům chipu přes EmailJS.
   -------------------------------------------------------------
   Mail odesílá PROHLÍŽEČ řidiče, který právě zakládá rezervaci.
   Z toho plynou dvě věci:
     · funguje to jen ve chvíli, kdy je stránka otevřená
       → hodí se na „vznikla rezervace", ne na ranní souhrn
     · když odeslání selže, rezervace už v databázi je
       → chybu jen ohlásíme, rezervaci nerušíme

   Není-li EmailJS nakonfigurovaný, funkce tiše nic nedělá
   a aplikace funguje dál bez notifikací.
   ============================================================= */

window.PARK = window.PARK || {};

window.PARK.notify = (function () {
  var cfg = window.PARK.config;
  var util = window.PARK.util;
  var pripraveno = false;

  function jeNastaveno() {
    return !!(cfg.EMAILJS_PUBLIC_KEY && cfg.EMAILJS_SERVICE_ID &&
              cfg.EMAILJS_TEMPLATE_ID && window.emailjs);
  }

  function init() {
    if (!jeNastaveno() || pripraveno) return;
    window.emailjs.init({ publicKey: cfg.EMAILJS_PUBLIC_KEY });
    pripraveno = true;
  }

  /** Posílat jen pro rezervace v nejbližších dnech — jinak je toho moc. */
  function jeBlizko(datum) {
    var hranice = util.pridej(util.dnes(), cfg.NOTIFIKACE_DNU_DOPREDU);
    return datum <= hranice;
  }

  /**
   * Upozornění na nově vzniklé rezervace.
   * @param {string[]} dny        seznam dnů 'YYYY-MM-DD'
   * @param {string}   mistoKod   P1 .. P4
   * @param {object[]} drzitele   [{ email, jmeno }]
   * @returns {Promise} vždy se splní — chybu jen zaloguje
   */
  function novaRezervace(dny, mistoKod, drzitele) {
    init();
    if (!pripraveno) return Promise.resolve({ preskoceno: 'EmailJS není nastaven' });

    var blizke = dny.filter(jeBlizko);
    if (blizke.length === 0) return Promise.resolve({ preskoceno: 'rezervace je daleko' });

    var adresy = (drzitele || [])
      .filter(function (d) { return d.aktivni !== false && d.email; })
      .map(function (d) { return d.email; });
    if (adresy.length === 0) return Promise.resolve({ preskoceno: 'žádní adresáti' });

    var vypisDnu = blizke.map(util.denMesic).join(', ');
    var zprava =
      'Na stání ' + mistoKod + ' je nově rezervace na tyto dny: ' + vypisDnu + '\n\n' +
      'Na toto stání v uvedené dny nevjíždějte. Ostatní stání zkontrolujte ' +
      'v přehledu obsazenosti před vjezdem.\n\n' +
      (cfg.ADRESA_WEBU || '');

    return window.emailjs.send(cfg.EMAILJS_SERVICE_ID, cfg.EMAILJS_TEMPLATE_ID, {
      to_email: adresy.join(','),          // šablona musí mít v poli To hodnotu {{to_email}}
      predmet: 'Parkování Střekov — stání ' + mistoKod + ' rezervováno (' + vypisDnu + ')',
      stani: mistoKod,
      dny: vypisDnu,
      zprava: zprava,
      odkaz: cfg.ADRESA_WEBU || ''
    }).then(function () {
      return { odeslano: adresy.length };
    }).catch(function (e) {
      // Rezervace je uložená, mail je jen doplněk — nešíříme chybu dál.
      console.warn('Upozornění se nepodařilo odeslat:', e);
      return { chyba: (e && (e.text || e.message)) || 'neznámá chyba' };
    });
  }

  return { novaRezervace: novaRezervace, jeNastaveno: jeNastaveno };
})();

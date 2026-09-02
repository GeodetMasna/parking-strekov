/* =============================================================
   Konfigurace aplikace
   -------------------------------------------------------------
   Necháte-li SUPABASE_URL prázdné, aplikace běží v DEMO REŽIMU
   s ukázkovými daty v paměti prohlížeče — nic se nikam neukládá.
   To je záměr: repozitář jde otevřít a ukázat i bez backendu.

   Pro ostrý provoz vyplňte údaje z Supabase:
     Project Settings → API → Project URL a anon public key.
   Anon klíč je určen do prohlížeče, bezpečnost zajišťují
   RLS politiky v supabase/schema.sql. NIKDY sem nedávejte
   service_role klíč.
   ============================================================= */

window.PARK = window.PARK || {};

window.PARK.config = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  // Kolik dnů dopředu lze rezervovat
  HORIZONT_DNU: 21,

  // Maximální počet aktivních budoucích rezervací na jednoho řidiče
  MAX_REZERVACI_NA_OSOBU: 5,

  // Nabízet i víkendy?
  POVOLIT_VIKENDY: false,

  // Doména firemních e-mailů (jen nápověda ve formuláři)
  FIREMNI_DOMENA: 'strabag.com',

  /* ----- Upozornění držitelům chipu přes EmailJS -----
     Mail odesílá prohlížeč toho, kdo rezervaci zakládá.
     Nevyplněné hodnoty = notifikace se neposílají, zbytek funguje.
     Veřejný klíč EmailJS omezte v jejich administraci na doménu webu,
     jinak přes vaši šablonu může posílat kdokoliv. */
  EMAILJS_PUBLIC_KEY: '',
  EMAILJS_SERVICE_ID: '',
  EMAILJS_TEMPLATE_ID: '',

  // Upozorňovat jen na rezervace v tomto počtu dnů dopředu.
  // Vzdálenější rezervace jsou v přehledu, mailem se neposílají.
  NOTIFIKACE_DNU_DOPREDU: 2,

  // Adresa webu do textu mailu (odkaz na přehled obsazenosti)
  ADRESA_WEBU: 'https://geodetmasna.github.io/parking-strekov'
};

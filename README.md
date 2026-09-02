# Parkování Střekov — rezervace nabíjecích stání

Prototyp rezervačního systému pro 4 nabíjecí stání za závorou na centrále STRABAG Rail ve Střekově.
Statický web (GitHub Pages) + Supabase jako databáze. Bez build kroku, bez frameworku.
Knihovny i písma jsou součástí webu — aplikace nedělá jediný požadavek na cizí doménu,
aby fungovala i ve firemní síti s blokovanými CDN.

Souběžně s tímto prototypem vzniká varianta na Power Platform (SharePoint + Power Apps).
Prototyp slouží k rychlému ověření s lidmi — hlavně toho, jestli si držitelé chipu obsazenost
opravdu zkontrolují, než vjedou.

## Co to umí

- **Veřejný pohled bez přihlášení** — panel „Dnes“ se čtyřmi stání a jednovětým závěrem,
  co z toho plyne pro řidiče spalovacího vozu, plus týdenní mřížka. Žádné SPZ, žádná jména.
- **Rezervace po přihlášení** — jen pro řidiče na seznamu, jen firemní elektromobily,
  jeden den nebo celý pracovní týden. Rezervace je celodenní.
- **Přihlášení e-mailem a heslem**, které přiděluje správce. Samoobslužná registrace je
  vypnutá, uživatel si přidělené heslo může změnit v aplikaci.
- **Ochrana proti dvojité rezervaci** na úrovni databáze (částečný unikátní index),
  ne jen kontrolou ve formuláři.
- **Demo režim** — bez vyplněné konfigurace běží aplikace s ukázkovými daty v paměti.
  Stačí otevřít `index.html`.

## Pravidla, která systém vynucuje

1. Rezervovat lze **výhradně firemní elektromobil**, vždy předem.
2. Vozidlo se spalovacím motorem si stání **rezervovat nemůže**. Zaparkovat smí jen tehdy,
   není-li na daný den evidována rezervace daného stání.
3. Držitel chipu je povinen **před každým vjezdem** ověřit obsazenost.
4. Každé jednotlivé porušení = **okamžité odevzdání chipu**.

Body 3 a 4 systém nevymáhá — vymáhá je podepsané poučení. Aplikace jen zajišťuje,
že kontrola trvá deset vteřin.

## Struktura

```
index.html            jediná stránka aplikace
assets/config.js      konfigurace (Supabase URL a klíč, limity)
assets/util.js        práce s daty ve formátu YYYY-MM-DD
assets/data.js        datová vrstva — Supabase i demo režim
assets/notify.js      upozornění držitelům chipu přes EmailJS (volitelné)
assets/ui.js          vykreslování dlaždic a mřížky
assets/app.js         události a propojení
assets/fonts.css      lokální písma (Archivo, IBM Plex Mono — SIL OFL)
assets/fonts/         soubory písem, subset latin + latin-ext
assets/vendor/        supabase-js a emailjs — lokálně, bez CDN
.github/workflows/deploy.yml   nasazení na GitHub Pages po pushi
supabase/schema.sql   tabulky, indexy, RLS politiky, veřejné pohledy
supabase/seed.sql     naplnění číselníků
docs/NASAZENI-SUPABASE.md  postup nasazení krok za krokem
docs/NAHRANI-PRES-WEB.md   nahrání na GitHub bez gitu, přes prohlížeč
nasadit.cmd / .sh     složka dist/ pro ruční nasazení jinam
_headers, netlify.toml   pro případné nasazení na Netlify
```

Soubory jsou záměrně krátké a komentované česky, aby v nich šlo dělat úpravy bez znalosti
celého kódu.

## Nasazení

> Podrobný postup krok za krokem včetně nastavení SMTP a ověření zabezpečení:
> [`docs/NASAZENI-SUPABASE.md`](docs/NASAZENI-SUPABASE.md). Níže je zkrácená verze.

### 1. Supabase

1. Založte projekt na [supabase.com](https://supabase.com) — **jako region zvolte EU**
   (Frankfurt), data zůstanou v EU.
2. SQL Editor → New query → vložte obsah `supabase/schema.sql` → Run.
3. Totéž s `supabase/seed.sql`, ale nejdřív upravte e-maily řidičů a SPZ vozidel.
4. Authentication → Providers: nechte zapnutý jen **Email**, vypněte
   *Allow new users to sign up* a nastavte minimální délku hesla na 8.
   SMTP není potřeba — z aplikace neodchází žádný systémový e-mail.
5. Uživatele zakládejte **vždy dvěma kroky**: Authentication → Users → Add user
   (se zaškrtnutým *Auto Confirm User*) **a** řádek v tabulce `ridici`.
6. Settings → API Keys: zkopírujte **Project URL** a **publishable** klíč
   (`sb_publishable_…`; u starších projektů **anon public** ve formátu JWT).

> Publishable klíč patří do prohlížeče, je to tak správně — přístup hlídají RLS politiky.
> Klíč `sb_secret_…` (dříve `service_role`) do repozitáře **nikdy** nepatří.

### 2. Konfigurace

V `assets/config.js` vyplňte:

```js
SUPABASE_URL: 'https://xxxxxxxx.supabase.co',
SUPABASE_ANON_KEY: 'sb_publishable_...'
```

Dokud jsou prázdné, běží demo režim.

### 3. Nasazení na GitHub Pages

Ve firemní síti STRABAGu je Netlify blokované, proto web běží na GitHub Pages.

> Nahráváte-li přes webové rozhraní GitHubu bez gitu, řiďte se
> [`docs/NAHRANI-PRES-WEB.md`](docs/NAHRANI-PRES-WEB.md) — složku `.github` prohlížeč
> při přetahování nenabídne a workflow se musí vytvořit ručně.

1. Založte na GitHubu repozitář `parkovani-strekov`. **Musí být veřejný** — Pages
   z privátního repozitáře vyžadují placený plán (GitHub Pro).
2. Nahrajte obsah:

```bash
git remote add origin https://github.com/<vas-ucet>/parkovani-strekov.git
git branch -M main
git push -u origin main
```

3. V repozitáři: **Settings → Pages → Source: GitHub Actions**.
4. Hotovo. Workflow `.github/workflows/deploy.yml` po každém pushi sestaví složku
   `dist` a nasadí ji. Adresa bude `https://<vas-ucet>.github.io/parkovani-strekov/`.

Workflow na web pouští **jen `index.html` a `assets/`**. Složky `supabase/` a `docs/`
zůstávají v repozitáři, ale na web nejdou — a build se zastaví, kdyby se tam nějaký
SQL nebo MD soubor přece jen dostal.

> **Pozor u veřejného repozitáře:** `supabase/seed.sql` je v repu vidět. Nechte v něm
> zástupné hodnoty a skutečné e-maily kolegů a SPZ zadávejte rovnou v Supabase
> Table Editoru. To samé platí pro `drzitele_cipu`.

Bezpečnostní hlavičky ze souboru `_headers` na GitHub Pages nefungují — Pages neumí
vlastní HTTP hlavičky. Pro tento web to není podstatné, ale je dobré o tom vědět.

### 4. Ruční nasazení (Netlify drop a podobně)

Pokud byste web potřeboval nasadit ručně jinam, `nasadit.cmd` (Windows) nebo
`./nasadit.sh` připraví složku `dist` k přetažení.

## Než to půjde do ostrého provozu

- **Ověřit dostupnost Supabase z firemní sítě.** Blokovaný Netlify je varování —
  když je z firemní sítě nedostupná i doména `*.supabase.co`, aplikace se nenačte
  daty a prototyp nemá smysl. Vyzkoušejte dřív, než budete cokoli stěhovat.
- **Schválení IT a GDPR.** GitHub Pages i Supabase jsou mimo firemní infrastrukturu.
  I když je veřejný pohled bez osobních údajů, v databázi jsou jména, e-maily a SPZ.
  Pro ostrý provoz je čistší varianta na Power Platform, kde data zůstanou v M365.
- **Očíslování stání** na povrchu (P1–P4), jinak pravidlo u závory nevymůžete.
- **Podpisy poučení** držitelů chipu — bez nich je sankce nevymahatelná.
- **Notifikace** při vzniku rezervace posílá prohlížeč přes EmailJS — volitelné, nastavuje se
  v `config.js` (viz `docs/NASAZENI-SUPABASE.md`, kapitola 11). Plánované souhrny (ranní mail)
  tudy nejdou, na ty je potřeba `pg_cron` v Supabase nebo jiná plánovaná úloha.

## Licence

Interní materiál STRABAG Rail.

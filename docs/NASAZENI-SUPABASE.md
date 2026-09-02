# Nasazení na Supabase — krok za krokem

Postup od prázdného účtu k funkčnímu systému. Počítejte s ~30 minutami, plus čekání na
zřízení databáze.

> **Přihlašování je heslem, které přiděluje správce.** Supabase proto nepotřebuje žádné
> SMTP a odpadá nejzdlouhavější část nasazení. Pozor jen na to, že založení uživatele má
> vždy dva kroky — účet i řádek v tabulce `ridici` (krok 4.2).

---

## 1. Založení projektu

1. [supabase.com](https://supabase.com) → **New project**
2. Vyplňte:
   - **Name:** `parkovani-strekov`
   - **Database password:** nechte vygenerovat a **uložte do správce hesel**. Znovu se
     nezobrazí. Pro běžný provoz ho nepotřebujete, jen pro přímé připojení k databázi.
   - **Region:** `Central EU (Frankfurt)` — data zůstanou v EU, což je podmínka pro
     schválení ze strany IT a GDPR.
   - **Plan:** Free
3. Zřízení trvá 1–2 minuty.

**Co dává Free plán:** 500 MB databáze, 50 000 aktivních uživatelů měsíčně, 2 aktivní
projekty, žádné automatické zálohy. Pro čtyři stání a deset lidí je to řádově naddimenzované.

**Pozor na pauzu:** projekt na Free plánu se **po týdnu bez jediného požadavku pozastaví**.
Provozní použití (QR kód u závory, ranní kontrola) tomu předejde samo, ale přes delší
odstávku firmy se to stát může — projekt se pak obnoví jedním kliknutím v dashboardu.

---

## 2. Databázové schéma

1. Levé menu → **SQL Editor** → **New query**
2. Vložte celý obsah `supabase/schema.sql`
3. **Run** (Ctrl+Enter)

Očekávaný výsledek: `Success. No rows returned`.

Skript lze spustit opakovaně — používá `if not exists`, `create or replace` a
`drop policy if exists`, takže opakované spuštění nic nerozbije.

**Ověření:** Table Editor musí ukázat tabulky `mista`, `ridici`, `vozidla`, `rezervace`,
`drzitele_cipu`, `poruseni`. Database → Views musí obsahovat `v_obsazenost` a `v_mista`.

---

## 3. Číselníky

**Nejdřív upravte `supabase/seed.sql`**, teprve pak spouštějte:

- e-mail správce → váš firemní e-mail, **malými písmeny**
- SPZ a modely skutečných firemních elektromobilů
- popisy stání podle skutečnosti

E-mail musí přesně odpovídat tomu, kterým se člověk bude přihlašovat. Velikost písmen hraje
roli — politiky porovnávají `lower(email)`, takže do tabulky patří malá písmena.

Pak: SQL Editor → New query → vložit → **Run**.

**Ověření:** Table Editor → `mista` má 4 řádky, `ridici` aspoň jeden se `spravce = true`.

---

## 4. Přihlašování — účty a hesla

Účty zakládá správce a hesla přiděluje osobně. **Supabase tedy nepotřebuje žádné SMTP** —
z aplikace neodchází jediný systémový e-mail. Odpadá tím nejdelší krok celého nasazení.

### 4.1 Nastavení poskytovatele

**Authentication → Sign In / Providers → Email**

- **Enable Email provider:** zapnuto
- **Allow new users to sign up:** **vypnuto** — nikdo se nezaregistruje sám
- **Confirm email:** může zůstat zapnuté; účty zakládané správcem se potvrzují rovnou
- **Minimum password length:** nastavte aspoň `8`

### 4.2 Založení uživatele — vždy dva kroky

Přihlašovací účet a oprávnění rezervovat jsou dvě různé věci. Musí se udělat obojí:

1. **Authentication → Users → Add user**
   - e-mail (malými písmeny), heslo
   - zaškrtnout **Auto Confirm User** — jinak se uživatel nepřihlásí
2. **Table Editor → `ridici` → Insert**
   - stejný e-mail, `jmeno`, `aktivni = true`, případně `spravce = true`

Chybí-li druhý krok, přihlášení projde, ale rezervace skončí hláškou o porušení pravidel
přístupu. To je nejčastější zádrhel při zakládání lidí.

### 4.3 Předání hesla

Heslo předejte osobně nebo telefonem, ne e-mailem. V aplikaci má každý po přihlášení
tlačítko **Změnit heslo**, kterým si přidělené heslo nahradí vlastním — dejte lidem vědět,
ať to udělají hned.

### 4.4 Zapomenuté heslo

Samoobslužné obnovení není zapnuté (potřebovalo by SMTP). Správce nastaví nové heslo
v **Authentication → Users → ⋯ u řádku uživatele**. Pro deset lidí to stačí; kdyby to
začalo obtěžovat, doplní se SMTP a zapne se odkaz „Zapomenuté heslo".

### 4.5 Odebrání přístupu

`ridici` → `aktivni = false` zablokuje zakládání rezervací a je to obvykle dost.
Při odchodu ze firmy navíc smažte účet v **Authentication → Users**.

---

## 5. API klíče

**Settings → API Keys**

Zkopírujte:

- **Project URL** — `https://xxxxxxxxxxxx.supabase.co`
- **Publishable key** — začíná `sb_publishable_…`

U starších projektů může být místo publishable klíče uvedený **anon public** klíč ve formátu
JWT (`eyJ…`). Oba fungují stejně; Supabase legacy klíče postupně ukončuje do konce roku 2026,
takže u nového projektu použijte publishable.

> **Klíč `sb_secret_…` (dříve `service_role`) do prohlížeče ani do repozitáře nikdy nepatří.**
> Obchází všechna pravidla přístupu. Publishable klíč je naopak určený k tomu, aby byl
> veřejný — přístup hlídají RLS politiky, které jste nasadili v kroku 2.

---

## 6. Konfigurace aplikace

V `assets/config.js`:

```js
SUPABASE_URL: 'https://xxxxxxxxxxxx.supabase.co',
SUPABASE_ANON_KEY: 'sb_publishable_...'
```

Název proměnné zůstává `SUPABASE_ANON_KEY` i pro publishable klíč — mění se obsah, ne kód.

Pak commit a push do `main`. Workflow na GitHubu sestaví web a nasadí ho na Pages —
za minutu je změna venku. Na web jde jen `index.html` a `assets/`; `supabase/` a `docs/`
zůstávají v repozitáři, ale ne na webu.

**U veřejného repozitáře:** `seed.sql` je v repu vidět, takže v něm nechte zástupné
hodnoty a skutečné e-maily kolegů zadávejte rovnou v Supabase Table Editoru.

---

## 7. Zkouška provozu

1. Otevřete web. V patičce musí být **„Připojeno k Supabase"** místo „Demo režim".
2. **Nepřihlášený:** mřížka se vykreslí, všechna stání volná (zatím žádné rezervace).
3. **Přihlaste se** e-mailem a heslem, které jste si založili v kroku 4.2.
4. **Zarezervujte** stání na dnešek. V Table Editoru → `rezervace` musí přibýt řádek.
5. **Zkuste rezervovat totéž ještě jednou.** Aplikace musí odmítnout hláškou, že stání je
   už rezervované — to je unikátní index v databázi, ne kontrola ve formuláři.
6. **Zkuste tlačítko Změnit heslo** — nové heslo musí projít a příště se s ním přihlásíte.
7. **Odhlaste se.** Mřížka zůstane, ale SPZ zmizí.

---

## 8. Ověření, že data nejsou vidět zvenčí

Tohle si udělejte, než pošlete odkaz kolegům. Otevřete konzoli prohlížeče (F12) na
jakékoli stránce a spusťte s vlastními hodnotami:

```js
const URL = 'https://xxxxxxxxxxxx.supabase.co';
const KEY = 'sb_publishable_...';
fetch(URL + '/rest/v1/rezervace?select=*', { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } })
  .then(r => r.json()).then(console.log);
```

**Správný výsledek:** prázdné pole `[]` nebo chyba o oprávnění.
**Špatný výsledek:** vypsané rezervace se jmény a SPZ → RLS není aktivní, vraťte se ke kroku 2
a zkontrolujte, že skript proběhl celý.

Totéž zopakujte pro `/rest/v1/ridici` a `/rest/v1/vozidla`.

Doplňkově: **Advisors → Security Advisor** v dashboardu vypíše tabulky bez zapnutého RLS a
další nálezy. Po správném nasazení tam nemá být nic k tabulkám tohoto systému.

---

## 9. Provoz

| Úkon | Kde |
|---|---|
| **Přidat řidiče** | 1. Authentication → Users → Add user (e-mail, Auto Confirm)<br>2. Table Editor → `ridici` → Insert (stejný e-mail malými písmeny, `aktivni = true`) |
| **Odebrat řidiče** | `ridici` → `aktivni = false`. Historie rezervací zůstane. |
| **Přidat vozidlo** | `vozidla` → Insert. Vyřazené vozidlo `aktivni = false`, nemazat. |
| **Stání mimo provoz** | `mista` → `aktivni = false`. Zmizí z nabídky i z dlaždic jako „Mimo provoz". |
| **Vyřídit nahlášené porušení** | `poruseni` → přečíst záznam, po vyřešení `reseno = true`. Podklad pro odebrání chipu. |
| **Zrušit cizí rezervaci** | `rezervace` → `stav = 'zrusena'`. Nemazat — historie je doklad. |
| **Záloha** | Free plán nemá automatické zálohy. Jednou za čas Table Editor → `rezervace` → Export CSV, nebo `pg_dump` s heslem z kroku 1. |

---

## 10. Časté zádrhely

| Projev | Příčina a náprava |
|---|---|
| `Invalid login credentials` | Překlep v hesle, nebo účet ještě není v Authentication → Users. |
| Přihlášení projde, rezervace ne | Chybí řádek v tabulce `ridici` — viz krok 4.2. |
| `Email not confirmed` | Při zakládání účtu nebylo zaškrtnuté Auto Confirm User. |
| `new row violates row-level security policy` | Přihlášený e-mail není v tabulce `ridici`, nebo tam je s velkými písmeny. |
| `Invalid API key` | Překlep v `config.js`, nebo je tam klíč z jiného projektu. |
| Stránka hlásí „Demo režim" | `SUPABASE_URL` nebo klíč je prázdný. Zkontrolujte v záložce Actions, že nasazení proběhlo. |
| Stránka se načte, ale data ne | Z této sítě není dostupná doména `*.supabase.co`. Ověřte v konzoli prohlížeče (F12) na záložce Network. |
| Nejde rezervovat na včerejšek | Záměr — politika `rezervace_insert` vyžaduje `datum >= current_date`. |
| Projekt je pozastavený | Free plán, týden bez provozu. Restore v dashboardu, data zůstávají. |

---

## 11. Notifikace držitelům chipu (EmailJS)

Upozornění na novou rezervaci posílá **prohlížeč toho, kdo rezervaci zakládá** — proto
stačí EmailJS a není potřeba žádný server. Je to volitelné: bez vyplněné konfigurace
aplikace funguje dál, jen bez mailů.

### 11.1 Nastavení EmailJS

1. Registrace na [emailjs.com](https://www.emailjs.com), **Email Services → Add New Service**
   → Gmail → propojit účet, ze kterého mají upozornění chodit.
2. **Email Templates → Create New Template.** Do polí šablony dejte:
   - **To Email:** `{{to_email}}`
   - **Subject:** `{{predmet}}`
   - **Content:** `{{zprava}}` (stačí prosté tělo, aplikace posílá hotový text)
3. **Account → General:** zkopírujte **Public Key**, ze služby **Service ID**,
   ze šablony **Template ID**.
4. **Account → Security:** zapněte omezení na doménu a vyplňte adresu webu na Netlify.
   Bez toho může přes vaši šablonu posílat kdokoliv, kdo si zobrazí zdroj stránky.

### 11.2 Konfigurace aplikace

V `assets/config.js`:

```js
EMAILJS_PUBLIC_KEY: '...',
EMAILJS_SERVICE_ID: 'service_...',
EMAILJS_TEMPLATE_ID: 'template_...',
NOTIFIKACE_DNU_DOPREDU: 2,
ADRESA_WEBU: 'https://parkovani-strekov.netlify.app'
```

`NOTIFIKACE_DNU_DOPREDU` drží hlučnost na uzdě — mailem chodí jen rezervace na nejbližší
dny, vzdálenější si lidé přečtou v přehledu.

### 11.3 Adresáti

Tabulka `drzitele_cipu`. Naplňte ji v `seed.sql` nebo přes Table Editor. Do jednoho
odeslání jdou všechny aktivní adresy najednou, takže jedna rezervace spotřebuje
**jeden request**, ne jeden na osobu.

### 11.4 Hlášení o obsazeném stání

Stejná šablona obsluhuje i tlačítko **Stání někdo obsadil** v panelu „Dnes". Adresáty jsou
řidiči s příznakem `spravce = true` v tabulce `ridici` — mějte tam aspoň jednoho, jinak
hlášení skončí jen v evidenci `poruseni` a nikdo se o něm nedozví.

Záznam se uloží vždy, i když mail neodejde; aplikace v takovém případě napíše, že je
potřeba dát správci vědět jinak.

### 11.5 Limity a čeho se držet

- Free plán EmailJS: **200 požadavků měsíčně**, 2 šablony, tělo do 50 kB.
  Při běžném provozu (pár rezervací denně) to vystačí; kdyby ne, placený tarif je levný.
- Odeslání proběhne **jen když je stránka otevřená**. Pro „vznikla rezervace" to platí vždy,
  protože to dělá přihlášený řidič.
- Když odeslání selže, **rezervace zůstává platná** — aplikace to napíše do hlášky
  a nechá na řidiči, aby dal kolegům vědět jinak.

### 11.6 Co takhle nepůjde

**Ranní souhrn v 6:00** nebo **upozornění na zrušení, když je zrušeno automaticky** —
tam nikdo prohlížeč otevřený nemá. Když je budete chtít, potřebujete něco, co běží samo:

- **Netlify Scheduled Function** — cron na straně Netlify, načte data ze Supabase a odešle mail.
- **`pg_cron` + `pg_net`** přímo v Supabase — plánovaný dotaz zavolá odesílací službu.

Pro pilot bych s tím počkal. Dashboard u závory plus upozornění při vzniku rezervace
pokrývá to podstatné a ranní mail je hlavně další věc, kterou lidé přestanou číst.

## 12. Co dál

**Přechod na Power Platform.** Až padne rozhodnutí, data se z Supabase vyexportují do CSV
a nahrají do SharePoint listů. Struktura sloupců je záměrně stejná v obou variantách.

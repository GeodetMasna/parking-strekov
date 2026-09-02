# Nahrání na GitHub přes webové rozhraní

Bez gitu, jen přes prohlížeč. Počítejte s ~15 minutami.

Zádrhel, kvůli kterému stojí za to držet se pořadí: **prohlížeč při přetahování většinou
vůbec nenabídne složky začínající tečkou.** Soubor s workflow proto nevznikne přetažením,
ale napíše se přímo na GitHubu (krok 3). Bez něj se web nenasadí.

---

## 1. Založení repozitáře

1. GitHub → **New repository**
2. Name: `parkovani-strekov`
3. **Public** — Pages z privátního repozitáře vyžadují placený plán
4. **Nezaškrtávejte** *Add a README*, `.gitignore` ani licenci — repozitář musí zůstat prázdný
5. **Create repository**

---

## 2. Nahrání souborů

Rozbalte ZIP. Na stránce prázdného repozitáře klikněte na **uploading an existing file**.

Přetáhněte tyto položky (označte je ve správci souborů a přetáhněte najednou):

- `index.html`
- `README.md`
- složku `assets`
- složku `supabase`
- složku `docs`
- složku `cedule`
- `nasadit.cmd`, `nasadit.sh`, `netlify.toml`

**Nenahrávejte** složku `dist` (je to jen dočasný výstup) ani `.git`, `.github`,
`.gitignore`, `.nojekyll`, `_headers` — na ty dojde v dalším kroku, respektive nejsou potřeba.

Dole napište zprávu commitu, například `Prototyp rezervace nabíjecích stání`,
a potvrďte **Commit changes**.

> Struktura složek se při přetažení zachová — `assets/fonts/` i `assets/vendor/`
> se nahrají správně.

---

## 3. Workflow — napsat ručně

Tohle je ten krok, který přetažením neuděláte.

1. V repozitáři: **Add file → Create new file**
2. Do pole s názvem souboru napište přesně:

```
.github/workflows/deploy.yml
```

   Jakmile napíšete lomítko, GitHub samo vytvoří složky — pole se rozpadne na
   `.github` / `workflows` / `deploy.yml`.

3. Do těla souboru vložte obsah `.github/workflows/deploy.yml` z rozbaleného ZIPu
   (otevřete ho v Poznámkovém bloku a zkopírujte celý).
4. **Commit changes**

---

## 4. Zapnutí Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions**

Nic dalšího se tam nevyplňuje.

---

## 5. Kontrola

Záložka **Actions** → uvidíte běžící úlohu *Nasazení na GitHub Pages*.
Trvá zhruba minutu. Po zelené fajfce je adresa
`https://<vas-ucet>.github.io/parkovani-strekov/`.

Ve výpisu úlohy je vidět i seznam souborů, které šly na web — mají tam být jen
`index.html` a `assets/`. Kdyby se mezi ně dostal SQL nebo MD soubor, build se
záměrně zastaví.

---

## 6. Další úpravy

Malé změny (třeba doplnění klíčů do `assets/config.js`) se dělají přímo na GitHubu:
otevřete soubor → ikona tužky → upravit → **Commit changes**. Workflow se spustí sám
a za minutu je změna na webu.

Větší úpravy je pohodlnější dělat lokálně a nahrát znovu přes **Add file → Upload files** —
stejnojmenné soubory se přepíší.

---

## Když se něco nepovede

| Projev | Příčina |
|---|---|
| V Actions není žádná úloha | Chybí `.github/workflows/deploy.yml` (krok 3), nebo je ve špatné cestě. |
| Úloha spadne na „No such file or directory" | Nenahrálo se `index.html` nebo složka `assets`. |
| Úloha spadne na kontrole citlivých dat | Do `assets/` se dostal SQL nebo MD soubor. Smažte ho z `assets/`. |
| Web ukazuje výpis souborů místo aplikace | `index.html` není v kořeni repozitáře, ale v podsložce. |
| Stránka je bez formátování | Nenahrála se celá složka `assets` — zkontrolujte, že jsou tam i `fonts/` a `vendor/`. |

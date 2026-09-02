-- =============================================================
--  Rezervace nabíjecích stání — Střekov
--  Schéma pro Supabase (PostgreSQL)
--  Spustit v Supabase Studio → SQL Editor → New query
-- =============================================================
--  Princip zabezpečení:
--    * anon (nepřihlášený návštěvník) vidí POUZE view v_obsazenost
--      = volno / obsazeno / mimo provoz, bez SPZ a bez jmen
--    * authenticated (řidič ze seznamu) vidí detaily a zakládá rezervace
--    * dvojité rezervaci brání částečný unikátní index, ne aplikace
-- =============================================================

-- ---------- 1. Číselník stání --------------------------------
create table if not exists public.mista (
  kod            text primary key,                    -- P1 .. P4
  popis          text,
  typ_nabijecky  text,
  aktivni        boolean not null default true,
  mimo_provoz_od date,
  mimo_provoz_do date,
  poradi         int not null default 0
);

-- ---------- 2. Řidiči oprávnění rezervovat -------------------
-- Whitelist. Kdo tu není, nemůže založit rezervaci ani po přihlášení.
create table if not exists public.ridici (
  email     text primary key,                          -- firemní mail, malými písmeny
  jmeno     text not null,
  aktivni   boolean not null default true,
  spravce   boolean not null default false,
  vytvoreno timestamptz not null default now()
);

-- ---------- 3. Firemní elektromobily -------------------------
create table if not exists public.vozidla (
  id            uuid primary key default gen_random_uuid(),
  spz           text not null unique,
  model         text,
  pohon         text not null default 'BEV' check (pohon in ('BEV','PHEV')),
  hlavni_ridic  text references public.ridici(email),
  aktivni       boolean not null default true
);

-- ---------- 4. Rezervace -------------------------------------
create table if not exists public.rezervace (
  id           uuid primary key default gen_random_uuid(),
  datum        date not null,
  misto_kod    text not null references public.mista(kod),
  vozidlo_id   uuid not null references public.vozidla(id),
  ridic_email  text not null references public.ridici(email),
  stav         text not null default 'aktivni'
                 check (stav in ('aktivni','zrusena','nevyuzita')),
  poznamka     text,
  vytvoreno    timestamptz not null default now(),
  zmeneno      timestamptz not null default now()
);

-- Klíčová pojistka: na jedno stání a den může existovat jen jedna
-- AKTIVNÍ rezervace. Zrušená rezervace místo neblokuje.
create unique index if not exists ux_rezervace_misto_den
  on public.rezervace (datum, misto_kod)
  where stav = 'aktivni';

create index if not exists ix_rezervace_datum on public.rezervace (datum);
create index if not exists ix_rezervace_ridic on public.rezervace (ridic_email);

-- Automatická aktualizace sloupce zmeneno
create or replace function public.tg_touch()
returns trigger language plpgsql as $$
begin
  new.zmeneno := now();
  return new;
end $$;

drop trigger if exists trg_rezervace_touch on public.rezervace;
create trigger trg_rezervace_touch
  before update on public.rezervace
  for each row execute function public.tg_touch();

-- ---------- 5. Držitelé chipu k závoře -----------------------
-- Řidiči spalovacích vozů. Rezervovat nemohou — jsou to adresáti
-- upozornění a zároveň evidence pro pravidlo o vracení chipu.
create table if not exists public.drzitele_cipu (
  email          text primary key,
  jmeno          text not null,
  spz            text,
  cislo_cipu     text,
  aktivni        boolean not null default true,
  datum_pouceni  date,
  pocet_poruseni int not null default 0,
  vytvoreno      timestamptz not null default now()
);

-- ---------- 6. Evidence porušení -----------------------------
create table if not exists public.poruseni (
  id         uuid primary key default gen_random_uuid(),
  datum      date not null default current_date,
  misto_kod  text references public.mista(kod),
  popis      text not null,
  nahlasil   text,
  reseno     boolean not null default false,
  vytvoreno  timestamptz not null default now()
);

-- =============================================================
--  VEŘEJNÝ POHLED — bez osobních údajů
-- =============================================================
-- Vrací jen to, co potřebuje řidič spalovacího vozu u závory:
-- které stání je na daný den obsazené. Žádná SPZ, žádné jméno.
create or replace view public.v_obsazenost
with (security_invoker = off) as
  select r.datum,
         r.misto_kod
  from public.rezervace r
  where r.stav = 'aktivni'
    and r.datum >= current_date - 7;

-- Veřejný číselník stání (kód a stav provozu, nic citlivého)
create or replace view public.v_mista
with (security_invoker = off) as
  select m.kod, m.popis, m.typ_nabijecky, m.aktivni,
         m.mimo_provoz_od, m.mimo_provoz_do, m.poradi
  from public.mista m
  order by m.poradi, m.kod;

-- =============================================================
--  ROW LEVEL SECURITY
-- =============================================================
alter table public.mista     enable row level security;
alter table public.ridici    enable row level security;
alter table public.vozidla   enable row level security;
alter table public.rezervace enable row level security;
alter table public.poruseni  enable row level security;
alter table public.drzitele_cipu enable row level security;

-- Pomocná funkce: je přihlášený uživatel na seznamu řidičů?
create or replace function public.je_ridic()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ridici
    where email = lower(auth.jwt() ->> 'email') and aktivni
  );
$$;

create or replace function public.je_spravce()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ridici
    where email = lower(auth.jwt() ->> 'email') and aktivni and spravce
  );
$$;

-- --- mista ---------------------------------------------------
drop policy if exists mista_select on public.mista;
create policy mista_select on public.mista
  for select to authenticated using (true);

drop policy if exists mista_write on public.mista;
create policy mista_write on public.mista
  for all to authenticated using (public.je_spravce()) with check (public.je_spravce());

-- --- ridici --------------------------------------------------
drop policy if exists ridici_select on public.ridici;
create policy ridici_select on public.ridici
  for select to authenticated using (true);

drop policy if exists ridici_write on public.ridici;
create policy ridici_write on public.ridici
  for all to authenticated using (public.je_spravce()) with check (public.je_spravce());

-- --- vozidla -------------------------------------------------
drop policy if exists vozidla_select on public.vozidla;
create policy vozidla_select on public.vozidla
  for select to authenticated using (true);

drop policy if exists vozidla_write on public.vozidla;
create policy vozidla_write on public.vozidla
  for all to authenticated using (public.je_spravce()) with check (public.je_spravce());

-- --- rezervace -----------------------------------------------
-- Přihlášený řidič vidí všechny rezervace (potřebuje vědět, kdo kde stojí).
drop policy if exists rezervace_select on public.rezervace;
create policy rezervace_select on public.rezervace
  for select to authenticated using (public.je_ridic());

-- Zakládat smí jen sám za sebe a jen pokud je na seznamu.
drop policy if exists rezervace_insert on public.rezervace;
create policy rezervace_insert on public.rezervace
  for insert to authenticated
  with check (
    public.je_ridic()
    and ridic_email = lower(auth.jwt() ->> 'email')
    and datum >= current_date
  );

-- Měnit (rušit) smí jen svou vlastní rezervaci; správce jakoukoli.
drop policy if exists rezervace_update on public.rezervace;
create policy rezervace_update on public.rezervace
  for update to authenticated
  using (public.je_spravce() or ridic_email = lower(auth.jwt() ->> 'email'))
  with check (public.je_spravce() or ridic_email = lower(auth.jwt() ->> 'email'));

-- Mazat nikdo — rezervace se ruší změnou stavu, historie zůstává.

-- --- drzitele_cipu -------------------------------------------
-- Přihlášený řidič potřebuje seznam adres, aby mohl z prohlížeče
-- odeslat upozornění (EmailJS). Nepřihlášený se sem nedostane.
drop policy if exists drzitele_select on public.drzitele_cipu;
create policy drzitele_select on public.drzitele_cipu
  for select to authenticated using (public.je_ridic());

drop policy if exists drzitele_write on public.drzitele_cipu;
create policy drzitele_write on public.drzitele_cipu
  for all to authenticated using (public.je_spravce()) with check (public.je_spravce());

-- --- poruseni ------------------------------------------------
drop policy if exists poruseni_select on public.poruseni;
create policy poruseni_select on public.poruseni
  for select to authenticated using (public.je_ridic());

drop policy if exists poruseni_insert on public.poruseni;
create policy poruseni_insert on public.poruseni
  for insert to authenticated with check (public.je_ridic());

-- =============================================================
--  PRÁVA PRO ANONYMNÍ PŘÍSTUP
-- =============================================================
-- Nepřihlášený návštěvník (QR kód u závory) smí číst pouze
-- dva veřejné pohledy. Na tabulky se nedostane vůbec.
revoke all on public.rezervace from anon;
revoke all on public.vozidla   from anon;
revoke all on public.ridici    from anon;
revoke all on public.mista     from anon;
revoke all on public.poruseni  from anon;
revoke all on public.drzitele_cipu from anon;

grant select on public.v_obsazenost to anon, authenticated;
grant select on public.v_mista      to anon, authenticated;

-- =============================================================
--  KONTROLA PO NASAZENÍ
-- =============================================================
-- 1) Otevřít dashboard nepřihlášený → mřížka se vykreslí, SPZ nikde.
-- 2) V Table editoru zkusit jako anon SELECT * FROM rezervace → chyba.
-- 3) Dvakrát rychle za sebou rezervovat stejné stání a den
--    → druhý pokus skončí chybou 23505 (unique violation). Tak to má být.

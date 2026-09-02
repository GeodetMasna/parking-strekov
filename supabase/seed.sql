-- =============================================================
--  Naplnění číselníků — upravit podle skutečnosti před spuštěním
-- =============================================================

-- ---------- Stání --------------------------------------------
insert into public.mista (kod, popis, typ_nabijecky, aktivni, poradi) values
  ('P1', 'Nejblíže vjezdu',        'AC 22 kW, Type 2', true, 1),
  ('P2', 'Druhé od vjezdu',        'AC 22 kW, Type 2', true, 2),
  ('P3', 'Třetí od vjezdu',        'AC 22 kW, Type 2', true, 3),
  ('P4', 'Nejdále od vjezdu',      'AC 22 kW, Type 2', true, 4)
on conflict (kod) do nothing;

-- ---------- Řidiči oprávnění rezervovat ----------------------
-- POZOR: e-maily malými písmeny, musí odpovídat firemnímu účtu.
insert into public.ridici (email, jmeno, aktivni, spravce) values
  ('jmeno.prijmeni@strabag.com', 'Jméno Příjmení', true, true)
on conflict (email) do nothing;

-- ---------- Držitelé chipu (spalovací vozy) ------------------
-- Adresáti upozornění. Rezervovat nemohou — jen dostávají zprávu,
-- že na daný den je stání obsazené.
insert into public.drzitele_cipu (email, jmeno, spz, cislo_cipu, aktivni) values
  ('kolega1@strabag.com', 'Kolega Jedna', '1AB 2345', 'CIP-01', true),
  ('kolega2@strabag.com', 'Kolega Dva',   '3CD 6789', 'CIP-02', true)
on conflict (email) do nothing;

-- ---------- Firemní elektromobily ----------------------------
insert into public.vozidla (spz, model, pohon, aktivni) values
  ('4AB 1234', 'Škoda Enyaq',   'BEV',  true),
  ('2UL 8890', 'VW ID.4',       'BEV',  true),
  ('5U9 4471', 'Škoda Superb',  'PHEV', true)
on conflict (spz) do nothing;

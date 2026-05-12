-- ═══════════════════════════════════════════════════════
--  MEYER METALLBAU GMBH — Supabase Datenbank Setup
--  Dieses SQL einmal im Supabase SQL-Editor ausführen
-- ═══════════════════════════════════════════════════════

-- Nutzer
create table if not exists users (
  id text primary key,
  name text not null,
  email text,
  pin_hash text,
  adresse text,
  telefon text,
  position text,
  rolle text default 'mitarbeiter',
  stundensatz numeric default 0,
  urlaub_tage_gesamt integer default 28,
  berechtigungen jsonb default '{}',
  dark_mode boolean default false,
  erstellt_am timestamptz default now()
);

-- Kunden
create table if not exists kunden (
  id text primary key,
  name text,
  firma text,
  ansprechpartner text,
  adresse text,
  plz text,
  ort text,
  telefon text,
  email text,
  notizen text,
  erstellt_am timestamptz default now()
);

-- Positionsvorlagen
create table if not exists positionen_vorlagen (
  id text primary key,
  bezeichnung text,
  einheit text,
  standardpreis numeric default 0,
  kategorie text,
  erstellt_von text,
  erstellt_am timestamptz default now()
);

-- Angebote
create table if not exists angebote (
  id text primary key,
  nummer text,
  kunde_id text,
  datum text,
  gueltig_bis text,
  status text default 'entwurf',
  positionen jsonb default '[]',
  gesamt_netto numeric default 0,
  mwst_satz numeric default 19,
  gesamt_brutto numeric default 0,
  briefpapier_modus boolean default false,
  erinnerung_am text,
  notizen text,
  erstellt_von text,
  erstellt_am timestamptz default now()
);

-- Aufträge
create table if not exists auftraege (
  id text primary key,
  nummer text,
  angebot_id text,
  kunde_id text,
  bezeichnung text,
  startdatum text,
  fertigstellung text,
  workflow_status text default 'auftrag',
  zustaendig jsonb default '[]',
  baustelle_adresse text,
  baustelle_ansprechpartner text,
  baustelle_telefon text,
  notizen text,
  erstellt_von text,
  erstellt_am timestamptz default now()
);

-- Auftrag-Positionen
create table if not exists auftrag_positionen (
  id text primary key,
  auftrag_id text,
  bezeichnung text,
  material text,
  massen text,
  menge numeric default 1,
  einheit text,
  einzelpreis numeric default 0,
  gesamtpreis numeric default 0
);

-- Rechnungen
create table if not exists rechnungen (
  id text primary key,
  nummer text,
  auftrag_id text,
  kunde_id text,
  typ text default 'schluss',
  datum text,
  leistungszeitraum text,
  zahlungsziel text,
  mwst_satz numeric default 19,
  status text default 'offen',
  positionen jsonb default '[]',
  gesamt_netto numeric default 0,
  gesamt_brutto numeric default 0,
  briefpapier_modus boolean default false,
  bezahlt_am text,
  erstellt_von text,
  erstellt_am timestamptz default now()
);

-- Zeiterfassung
create table if not exists zeiterfassung (
  id text primary key,
  user_id text,
  datum text,
  start_zeit text,
  pausen jsonb default '[]',
  end_zeit text,
  gesamt_minuten integer default 0,
  projekt_id text,
  projekt_label text,
  auftrag_id text,
  notiz text,
  sync_status text default 'synced',
  erstellt_am timestamptz default now()
);

-- Nachkalkulation
create table if not exists nachkalkulation (
  id text primary key,
  auftrag_id text,
  material_soll numeric default 0,
  material_ist numeric default 0,
  fremd_soll numeric default 0,
  fremd_ist numeric default 0,
  sonstige_soll numeric default 0,
  sonstige_ist numeric default 0,
  angebotspreis numeric default 0,
  erstellt_am timestamptz default now()
);

-- Aufgaben
create table if not exists aufgaben (
  id text primary key,
  titel text,
  beschreibung text,
  erstellt_von text,
  zugewiesen_an jsonb default '[]',
  auftrag_id text,
  erledigt boolean default false,
  faellig_am text,
  prioritaet text default 'normal',
  erstellt_am timestamptz default now()
);

-- Urlaub
create table if not exists urlaub (
  id text primary key,
  user_id text,
  von_datum text,
  bis_datum text,
  tage integer default 0,
  status text default 'abwartend',
  genehmigt_von text,
  erstellt_am timestamptz default now()
);

-- Dokumente
create table if not exists dokumente (
  id text primary key,
  auftrag_id text,
  name text,
  storage_url text,
  typ text,
  groesse integer,
  hochgeladen_von text,
  erstellt_am timestamptz default now()
);

-- Fotos
create table if not exists fotos (
  id text primary key,
  auftrag_id text,
  storage_url text,
  beschreibung text,
  aufgenommen_von text,
  erstellt_am timestamptz default now()
);

-- Unterschriften
create table if not exists unterschriften (
  id text primary key,
  auftrag_id text,
  storage_url text,
  unterzeichnet_von text,
  datum text,
  erstellt_am timestamptz default now()
);

-- Chat-Nachrichten
create table if not exists chat_nachrichten (
  id text primary key,
  von_user_id text,
  an_user_id text,
  auftrag_id text,
  text text,
  bilder text[] default '{}',
  gelesen boolean default false,
  erstellt_am timestamptz default now()
);

-- Falls Tabelle schon existiert, Spalte nachrüsten:
alter table chat_nachrichten add column if not exists bilder text[] default '{}';

-- Storage-Bucket für Chat-Bilder
insert into storage.buckets (id, name, public)
values ('chat-bilder', 'chat-bilder', true)
on conflict (id) do nothing;

-- Jeder eingeloggte User darf Bilder hochladen und lesen
create policy if not exists "chat bilder lesen" on storage.objects
  for select using (bucket_id = 'chat-bilder');

create policy if not exists "chat bilder hochladen" on storage.objects
  for insert with check (bucket_id = 'chat-bilder' and auth.role() = 'authenticated');

create policy if not exists "chat bilder loeschen" on storage.objects
  for delete using (bucket_id = 'chat-bilder' and auth.uid()::text = (storage.foldername(name))[1]);

-- Tickets
create table if not exists tickets (
  id text primary key,
  erstellt_von text,
  titel text,
  beschreibung text,
  prioritaet text default 'normal',
  status text default 'offen',
  admin_antwort text,
  erstellt_am timestamptz default now()
);

-- Backups (automatische Datensicherung)
create table if not exists backups (
  id text primary key,
  label text default 'Auto',
  data jsonb,
  erstellt_am timestamptz default now()
);

-- Einstellungen
create table if not exists einstellungen (
  id text primary key default 'main',
  firma_name text,
  strasse text,
  plz text,
  ort text,
  telefon text,
  email text,
  steuernummer text,
  ust_id text,
  iban text,
  bic text,
  geschaeftsfuehrer text,
  logo_url text,
  zahlungsziel_standard text default '14 Tage netto',
  skonto_text text,
  angebot_startnummer integer default 1,
  rechnung_startnummer integer default 1,
  auftrag_startnummer integer default 1
);

-- ═══════════════════════════════════════════════════════
--  Row Level Security (RLS) — alle Tabellen öffentlich
--  für eingeloggten App-Zugriff via anon key
-- ═══════════════════════════════════════════════════════

alter table backups enable row level security;
alter table users enable row level security;
alter table kunden enable row level security;
alter table positionen_vorlagen enable row level security;
alter table angebote enable row level security;
alter table auftraege enable row level security;
alter table auftrag_positionen enable row level security;
alter table rechnungen enable row level security;
alter table zeiterfassung enable row level security;
alter table nachkalkulation enable row level security;
alter table aufgaben enable row level security;
alter table urlaub enable row level security;
alter table dokumente enable row level security;
alter table fotos enable row level security;
alter table unterschriften enable row level security;
alter table chat_nachrichten enable row level security;
alter table tickets enable row level security;
alter table einstellungen enable row level security;

-- Alle Operationen für anon-Zugriff erlauben (App nutzt eigenes PIN-Login)
do $$
declare
  t text;
begin
  foreach t in array array[
    'backups','users','kunden','positionen_vorlagen','angebote','auftraege',
    'auftrag_positionen','rechnungen','zeiterfassung','nachkalkulation',
    'aufgaben','urlaub','dokumente','fotos','unterschriften',
    'chat_nachrichten','tickets','einstellungen'
  ] loop
    execute format('
      drop policy if exists "allow_all_%s" on %s;
      create policy "allow_all_%s" on %s
      for all to anon using (true) with check (true);
    ', t, t, t, t);
  end loop;
end $$;

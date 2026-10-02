-- Ricerca per vicinanza: coordinate per università e per stanze.
-- Esegui una volta nel SQL Editor di Supabase.

alter table public.universita add column if not exists latitudine  double precision;
alter table public.universita add column if not exists longitudine double precision;

alter table public.stanze add column if not exists indirizzo   text;
alter table public.stanze add column if not exists cap         text;
alter table public.stanze add column if not exists latitudine  double precision;
alter table public.stanze add column if not exists longitudine double precision;

-- Serve al prefiltro "bounding box" usato dalla ricerca.
create index if not exists stanze_lat_lon_idx on public.stanze (latitudine, longitudine);

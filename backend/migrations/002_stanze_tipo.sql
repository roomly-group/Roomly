-- Se `tipo` è NOT NULL e non vuoi gestirlo dall'app, rendilo opzionale:
alter table public.stanze alter column tipo drop not null;

-- Per vedere i valori ammessi (se è un enum):
-- select enum_range(null::tipo_stanza);  -- sostituisci col nome del tipo
-- select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.stanze'::regclass and contype = 'c';

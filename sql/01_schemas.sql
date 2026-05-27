begin;

create schema if not exists raw;
create schema if not exists staging;
create schema if not exists analytics;

create table if not exists raw.import_runs (
    import_run_id bigserial primary key,
    source_kind text not null check (source_kind in ('cammesa', 'enre')),
    source_name text not null,
    source_path text,
    source_hash text,
    status text not null default 'started' check (status in ('started', 'completed', 'failed')),
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    rows_read integer not null default 0,
    rows_loaded integer not null default 0,
    notes text,
    metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_import_runs_source_kind_started_at
    on raw.import_runs (source_kind, started_at desc);

commit;

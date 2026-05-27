begin;

create table if not exists analytics.dim_region (
    region_id smallserial primary key,
    region_code text not null unique,
    region_name text not null unique,
    sort_order smallint not null unique
);

insert into analytics.dim_region (region_code, region_name, sort_order)
values
    ('gran_bsas', 'Gran Buenos Aires', 1),
    ('buenos_aires', 'Buenos Aires', 2),
    ('centro', 'Centro', 3),
    ('litoral', 'Litoral', 4),
    ('cuyo', 'Cuyo', 5),
    ('noroeste', 'Noroeste', 6),
    ('noreste', 'Noreste', 7),
    ('comahue', 'Comahue', 8),
    ('patagonica', 'Patagonica', 9)
on conflict (region_code) do update
set region_name = excluded.region_name,
    sort_order = excluded.sort_order;

create table if not exists analytics.dim_sector_geo (
    sector_geo_id bigserial primary key,
    sector_geo_key text not null unique,
    empresa text,
    partido text,
    localidad text,
    subestacion text,
    alimentador text,
    nn text,
    canonical_name text,
    created_at timestamptz not null default now()
);

create index if not exists idx_dim_sector_geo_lookup
    on analytics.dim_sector_geo (empresa, partido, localidad);

create table if not exists analytics.region_sector_map (
    region_sector_map_id bigserial primary key,
    sector_geo_id bigint not null references analytics.dim_sector_geo(sector_geo_id) on delete cascade,
    region_id smallint not null references analytics.dim_region(region_id),
    mapping_source text not null default 'manual',
    confidence numeric(5, 2) not null default 1.00,
    notes text,
    unique (sector_geo_id)
);

create table if not exists analytics.fact_demanda_diaria (
    fact_demanda_id bigserial primary key,
    import_run_id bigint not null references raw.import_runs(import_run_id) on delete cascade,
    staging_cammesa_id bigint not null references staging.cammesa_demanda_diaria(staging_cammesa_id) on delete cascade,
    region_id smallint not null references analytics.dim_region(region_id),
    fecha date not null,
    anio integer not null,
    mes_numero smallint not null,
    tipo_dia text not null,
    demanda_mw numeric(14, 4) not null,
    demanda_total_mw numeric(14, 4),
    temperatura_media_c numeric(8, 3),
    inserted_at timestamptz not null default now(),
    unique (import_run_id, staging_cammesa_id, region_id)
);

create index if not exists idx_fact_demanda_fecha_region
    on analytics.fact_demanda_diaria (fecha, region_id);

create table if not exists analytics.fact_cortes_sector (
    fact_corte_id bigserial primary key,
    import_run_id bigint not null references raw.import_runs(import_run_id) on delete cascade,
    staging_enre_id bigint not null references staging.enre_cortes_sector(staging_enre_id) on delete cascade,
    sector_geo_id bigint not null references analytics.dim_sector_geo(sector_geo_id),
    region_id smallint references analytics.dim_region(region_id),
    fecha date not null,
    observed_at timestamptz,
    normalizacion_estimada timestamptz,
    nn text,
    tipo text,
    empresa text,
    afectados integer,
    has_missing_schedule boolean not null default false,
    inserted_at timestamptz not null default now(),
    unique (import_run_id, staging_enre_id)
);

create index if not exists idx_fact_cortes_fecha_region
    on analytics.fact_cortes_sector (fecha, region_id);

create index if not exists idx_fact_cortes_sector_geo
    on analytics.fact_cortes_sector (sector_geo_id, fecha);

commit;

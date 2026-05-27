begin;

create table if not exists staging.cammesa_demanda_diaria (
    staging_cammesa_id bigserial primary key,
    import_run_id bigint not null references raw.import_runs(import_run_id) on delete cascade,
    source_row_number integer not null,
    anio integer not null,
    mes_label text not null,
    fecha date not null,
    tipo_dia text not null,
    gran_bsas numeric(14, 4),
    buenos_aires numeric(14, 4),
    centro numeric(14, 4),
    litoral numeric(14, 4),
    cuyo numeric(14, 4),
    noroeste numeric(14, 4),
    noreste numeric(14, 4),
    comahue numeric(14, 4),
    patagonica numeric(14, 4),
    demanda_total numeric(14, 4),
    temperatura_media_c numeric(8, 3),
    inserted_at timestamptz not null default now(),
    unique (import_run_id, source_row_number),
    unique (import_run_id, fecha)
);

create index if not exists idx_cammesa_fecha
    on staging.cammesa_demanda_diaria (fecha);

create table if not exists staging.enre_cortes_sector (
    staging_enre_id bigserial primary key,
    import_run_id bigint not null references raw.import_runs(import_run_id) on delete cascade,
    source_chunk integer not null,
    source_row_number integer not null,
    source_id integer,
    latitud numeric(10, 7),
    longitud numeric(10, 7),
    nn text,
    tipo text,
    empresa text,
    partido text,
    localidad text,
    subestacion text,
    alimentador text,
    afectados integer,
    normalizacion_estimada_raw text,
    normalizacion_estimada timestamptz,
    observed_at timestamptz,
    has_missing_schedule boolean not null default false,
    inserted_at timestamptz not null default now(),
    unique (import_run_id, source_row_number),
    unique (import_run_id, source_id)
);

create index if not exists idx_enre_fecha_observacion
    on staging.enre_cortes_sector ((observed_at::date));

create index if not exists idx_enre_empresa_partido_localidad
    on staging.enre_cortes_sector (empresa, partido, localidad);

commit;

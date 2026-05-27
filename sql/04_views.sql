begin;

create or replace view analytics.v_demanda_diaria_region as
select
    f.fecha,
    f.anio,
    f.mes_numero,
    r.region_code,
    r.region_name,
    f.tipo_dia,
    f.demanda_mw,
    f.demanda_total_mw,
    f.temperatura_media_c
from analytics.fact_demanda_diaria f
join analytics.dim_region r on r.region_id = f.region_id;

create or replace view analytics.v_cortes_diarios_sector as
select
    f.fecha,
    f.empresa,
    g.partido,
    g.localidad,
    g.subestacion,
    g.alimentador,
    g.nn,
    r.region_code,
    r.region_name,
    count(*) as eventos_corte,
    sum(coalesce(f.afectados, 0)) as afectados_totales,
    count(*) filter (where f.has_missing_schedule) as eventos_sin_normalizacion
from analytics.fact_cortes_sector f
join analytics.dim_sector_geo g on g.sector_geo_id = f.sector_geo_id
left join analytics.dim_region r on r.region_id = f.region_id
group by
    f.fecha,
    f.empresa,
    g.partido,
    g.localidad,
    g.subestacion,
    g.alimentador,
    g.nn,
    r.region_code,
    r.region_name;

create or replace view analytics.v_training_daily_features as
with cortes_por_region as (
    select
        fecha,
        region_id,
        count(*) as eventos_corte,
        sum(coalesce(afectados, 0)) as afectados_totales,
        count(*) filter (where has_missing_schedule) as eventos_sin_normalizacion
    from analytics.fact_cortes_sector
    where region_id is not null
    group by fecha, region_id
)
select
    d.fecha,
    d.anio,
    d.mes_numero,
    r.region_code,
    r.region_name,
    d.tipo_dia,
    d.demanda_mw,
    d.demanda_total_mw,
    d.temperatura_media_c,
    coalesce(c.eventos_corte, 0) as eventos_corte,
    coalesce(c.afectados_totales, 0) as afectados_totales,
    coalesce(c.eventos_sin_normalizacion, 0) as eventos_sin_normalizacion
from analytics.fact_demanda_diaria d
join analytics.dim_region r on r.region_id = d.region_id
left join cortes_por_region c
    on c.fecha = d.fecha
   and c.region_id = d.region_id;

create or replace view analytics.v_region_sector_map_gaps as
select
    g.sector_geo_id,
    g.empresa,
    g.partido,
    g.localidad,
    g.subestacion,
    g.alimentador,
    g.nn,
    count(f.fact_corte_id) as eventos_sin_region
from analytics.dim_sector_geo g
left join analytics.region_sector_map m on m.sector_geo_id = g.sector_geo_id
left join analytics.fact_cortes_sector f
    on f.sector_geo_id = g.sector_geo_id
   and f.region_id is null
where m.region_sector_map_id is null
group by
    g.sector_geo_id,
    g.empresa,
    g.partido,
    g.localidad,
    g.subestacion,
    g.alimentador,
    g.nn;

commit;

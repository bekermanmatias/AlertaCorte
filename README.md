# AlertaCorte ⚡

Sistema Inteligente de Predicción de Colapso Energético en Redes, desarrollado mediante una Red Neuronal Artificial (Perceptrón Multicapa con Backpropagation).

**Universidad Tecnológica Nacional - Facultad Regional La Plata** **Ingeniería en Sistemas de Información - Inteligencia Artificial** **Grupo N° 11**

---

## Tecnologias Utilizadas

- **Entorno / ETL:** Node.js
- **Base de Datos:** Supabase Postgres
- **Modelo:** Brain.js

---

## Configuracion del Entorno

### 1. Prerrequisitos
- Tener instalado [Node.js](https://nodejs.org/) 18 o superior.
- Tener creado un proyecto en Supabase.
- Tener disponibles los archivos crudos en `data/raw/`.

### 2. Instalacion

```bash
git clone https://github.com/bekermanmatias/AlertaCorte.git
cd AlertaCorte
npm install
```

### 3. Variables de entorno
Copiar `.env.example` a `.env` y completar al menos:

```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
DB_SSL=true
PGAPPNAME=alertacorte_etl
CAMMESA_FILE_PATH=data/raw/cammesa_consumo_historico.xlsx
CAMMESA_SHEET=Datos Region
ENRE_SQL_DUMP_PATH=data/raw/datosenre.sql
```

### 4. Crear el esquema base

```bash
npm run db:setup
```

### 5. Cargar fuentes

```bash
npm run etl:cammesa
npm run etl:enre
```

## Arquitectura de datos

La base propia queda dividida en tres capas:

- `raw`: trazabilidad de corridas de importacion.
- `staging`: datos tipados y cercanos al origen.
- `analytics`: dimensiones, hechos y vistas para cruces y modelado.

Tablas principales:

- `raw.import_runs`
- `staging.cammesa_demanda_diaria`
- `staging.enre_cortes_sector`
- `analytics.dim_region`
- `analytics.dim_sector_geo`
- `analytics.region_sector_map`
- `analytics.fact_demanda_diaria`
- `analytics.fact_cortes_sector`

Vistas disponibles:

- `analytics.v_demanda_diaria_region`
- `analytics.v_cortes_diarios_sector`
- `analytics.v_training_daily_features`
- `analytics.v_region_sector_map_gaps`

## Estructura actual

```bash
ALERTACORTE/
├── data/
│   ├── raw/                 # Archivos fuente locales
│   └── processed/           # Salidas intermedias opcionales
├── sql/
│   ├── 01_schemas.sql
│   ├── 02_staging_tables.sql
│   ├── 03_analytics_tables.sql
│   └── 04_views.sql
├── src/
│   ├── config/
│   │   └── db.js
│   ├── etl/
│   │   ├── setupDatabase.js
│   │   ├── loadCammesa.js
│   │   └── loadEnre.js
│   └── utils/
│       ├── importRun.js
│       └── normalize.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

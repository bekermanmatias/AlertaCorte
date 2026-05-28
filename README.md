# AlertaCorte

Sistema Inteligente de Prediccion de Colapso Energetico en Redes del AMBA/GBA, desarrollado como Trabajo Practico Cuatrimestral de Inteligencia Artificial.

El proyecto implementa una Red Neuronal Artificial de tipo Perceptron Multicapa, entrenada con Backpropagation, para estimar con 24 horas de antelacion si existe riesgo de corte o estres critico de suministro electrico.

**Universidad Tecnologica Nacional - Facultad Regional La Plata**  
**Ingenieria en Sistemas de Informacion - Inteligencia Artificial**  
**Grupo N° 11 - 2026**

## Objetivo

AlertaCorte busca anticipar situaciones de riesgo en la red electrica metropolitana a partir de variables climaticas, de demanda y calendario. El enfoque evita reglas fijas del tipo "si supera cierto valor entonces hay alerta" y usa una RNA para aprender relaciones no lineales entre los patrones historicos y la ocurrencia de cortes o estres de red.

## Modelo Predictivo

Modelo aprobado para la entrega:

- **Tipo:** Perceptron Multicapa.
- **Entrenamiento:** Backpropagation.
- **Implementacion:** Brain.js sobre Node.js.
- **Validacion:** 25% de los patrones disponibles (`ML_VALIDATION_RATIO=0.25`).

Entradas de la red:

- `Tipo_Dia`: 1 para dia habil, 0 para fin de semana, feriado o no laborable.
- `Temperatura_Media_GBA`: temperatura media diaria de referencia para GBA/AMBA.
- `Demanda_Dia_Anterior`: demanda electrica del dia previo en MW.
- `Mes_Estacional`: mes numerico entre 1 y 12.

Salida esperada:

- `Alerta_Corte`: 1 indica riesgo de corte o estres critico, 0 indica estado normal.

## Stack

- **Node.js:** scripts ETL, entrenamiento, prediccion y API.
- **PostgreSQL / Supabase Postgres:** persistencia, staging y vistas analiticas.
- **Brain.js:** red neuronal.
- **Express:** API HTTP e interfaz web de demostracion.

## Estructura

```bash
ALERTACORTE/
├── api/                     # API Express
│   ├── routes/
│   ├── config.js
│   └── server.js
├── data/
│   ├── raw/                 # Archivos fuente locales
│   └── processed/           # Dataset final, modelo y metricas generadas
├── scripts/                 # Utilidades de dataset y puerto de API
├── sql/                     # Schemas, tablas y vistas
├── src/
│   ├── config/              # Conexion a base de datos
│   ├── etl/                 # Cargas CAMMESA y ENRE
│   ├── ml/                  # Dataset, escalado, entrenamiento y prediccion
│   └── utils/
├── web/                     # Interfaz web minima para demo
├── .env.example
├── package.json
└── README.md
```

## Configuracion Del Entorno

### 1. Prerrequisitos

- Node.js 18 o superior.
- Un proyecto PostgreSQL local o Supabase Postgres.
- Archivos fuente disponibles en `data/raw/`.

### 2. Instalacion

```bash
git clone https://github.com/bekermanmatias/AlertaCorte.git
cd AlertaCorte
npm install
```

### 3. Variables De Entorno

Copiar `.env.example` a `.env` y completar los valores de conexion:

```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
DB_SSL=true
PGAPPNAME=alertacorte_etl

CAMMESA_FILE_PATH=data/raw/cammesa_consumo_historico.xlsx
CAMMESA_SHEET=Datos Region
ENRE_SQL_DUMP_PATH=data/raw/datosenre.sql

ML_DATASET_PATH=data/processed/dataset_modelo_predictivo_final_con_alerta.csv
ML_MODEL_PATH=data/processed/alertacorte-model.json
ML_METRICS_PATH=data/processed/alertacorte-metrics.json
ML_VALIDATION_RATIO=0.25

API_HOST=127.0.0.1
API_PORT=3000
```

## Flujo De Ejecucion

### 1. Crear esquema base

```bash
npm run db:setup
```

### 2. Cargar fuentes

```bash
npm run etl:cammesa
npm run etl:enre
```

### 3. Completar dataset predictivo

```bash
npm run dataset:complete
```

El dataset final esperado queda en `data/processed/dataset_modelo_predictivo_final_con_alerta.csv`.

Ese CSV es el archivo de patrones que se entrega junto con el codigo. Por eso queda exceptuado del ignore del repositorio, a diferencia de los datos crudos y los artefactos generados del modelo.

### 4. Entrenar la RNA

```bash
npm run ml:train
```

El entrenamiento genera:

- `data/processed/alertacorte-model.json`
- `data/processed/alertacorte-metrics.json`

### 5. Probar una prediccion por consola

```bash
npm run ml:predict
```

### 6. Levantar API e interfaz web

```bash
npm run api:start
```

La API y la demo web quedan disponibles en:

- `http://127.0.0.1:3000/`
- `GET /api/health`
- `GET /api/model`
- `POST /api/predict`

Ejemplo de prediccion:

```bash
curl -X POST http://127.0.0.1:3000/api/predict \
  -H "Content-Type: application/json" \
  -d "{\"tipo_dia\":1,\"temperatura\":32.5,\"demanda\":8500,\"mes\":1}"
```

## Arquitectura De Datos

La base se organiza en tres capas:

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

## Scripts Disponibles

- `npm run db:setup`: crea schemas, tablas y vistas.
- `npm run etl:cammesa`: carga demanda historica CAMMESA.
- `npm run etl:enre`: carga cortes ENRE.
- `npm run dataset:complete`: genera/completa el dataset predictivo final.
- `npm run ml:train`: entrena la red neuronal y guarda modelo/metricas.
- `npm run ml:predict`: ejecuta una prediccion de prueba.
- `npm run api:start`: inicia API Express e interfaz web.
- `npm run api:restart`: libera el puerto configurado y reinicia la API.
- `npm test`: valida sintaxis de los archivos principales con `node --check`.

## Entrega Final

La entrega final debe incluir:

- Informe final en Word con resumen, introduccion, metodologia, resultados, discusion, conclusion y referencias.
- Codigo fuente de la RNA.
- Patrones de entrenamiento y prueba: `data/processed/dataset_modelo_predictivo_final_con_alerta.csv`.
- Resultados y metricas de validacion.
- Video MP4 de hasta 10 minutos con sonido mostrando el funcionamiento.

## Notas De Versionado

No se versionan credenciales, `.env`, datos crudos, artefactos generados del modelo ni configuraciones locales de Cursor (`.cursor/`). Como excepcion, se versiona `data/processed/dataset_modelo_predictivo_final_con_alerta.csv` porque es el dataset final requerido para la entrega.

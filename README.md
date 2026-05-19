# AlertaCorte ⚡

Sistema Inteligente de Predicción de Colapso Energético en Redes, desarrollado mediante una Red Neuronal Artificial (Perceptrón Multicapa con Backpropagation).

**Universidad Tecnológica Nacional - Facultad Regional La Plata** **Ingeniería en Sistemas de Información - Inteligencia Artificial** **Grupo N° 11**

---

## 🛠️ Tecnologías Utilizadas

- **Entorno / ETL:** Node.js
- **Base de Datos:** PostgreSQL
- **Red Neuronal:** Brain.js

---

## ⚙️ Configuración del Entorno Local

Sigan estos pasos para levantar el proyecto en sus máquinas locales de forma estandarizada.

### 1. Prerrequisitos
- Tener instalado [Node.js](https://nodejs.org/) (v18 o superior recomendada).
- Tener instalado [PostgreSQL](https://www.postgresql.org/).

### 2. Instalación
Clonar el repositorio e instalar las dependencias:

```bash
git clone [https://github.com/usuario/alertacorte.git](https://github.com/usuario/alertacorte.git)
cd alertacorte
npm install
```

```bash
ALERTACORTE/
├── data/
│   ├── raw/                 # Acá van los CSV pesados (poner un .gitkeep)
│   └── processed/           # Datos post ETL (poner un .gitkeep)
├── sql/
│   └── 01_schema.sql        # Script para crear las tablas de PostgreSQL
├── src/
│   ├── config/
│   │   └── db.js            # Lógica de conexión a la base de datos
│   ├── etl/
│   │   └── processData.js   # Script para leer, limpiar y normalizar los CSV
│   └── model/
│       └── network.js       # Arquitectura del Perceptrón de Brain.js
├── .env                     # Tus credenciales locales (ya ignorado por git)
├── .env.example             # Plantilla de credenciales para el grupo
├── .gitignore
├── package.json
└── README.md
```

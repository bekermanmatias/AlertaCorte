const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

function shouldUseSsl(connectionString) {
  const explicit = (process.env.DB_SSL || '').trim().toLowerCase();
  if (explicit === 'true') {
    return true;
  }

  if (explicit === 'false') {
    return false;
  }

  return Boolean(connectionString && connectionString.includes('supabase.co'));
}

function buildPoolConfig() {
  const connectionString = (process.env.DATABASE_URL || '').trim();
  const poolConfig = connectionString
    ? { connectionString }
    : {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST || 'localhost',
        port: Number.parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'alertacorte_db',
      };

  if (shouldUseSsl(connectionString)) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  if (process.env.PGAPPNAME) {
    poolConfig.application_name = process.env.PGAPPNAME;
  }

  return poolConfig;
}

const pool = new Pool(buildPoolConfig());

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function withClient(callback) {
  const client = await pool.connect();

  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

async function closePool() {
  await pool.end();
}

module.exports = {
  closePool,
  pool,
  query,
  withClient,
};

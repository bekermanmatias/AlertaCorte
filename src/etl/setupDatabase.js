const fs = require('fs/promises');
const path = require('path');

const { closePool, query } = require('../config/db');

async function main() {
  const sqlDir = path.resolve(process.cwd(), 'sql');
  const entries = await fs.readdir(sqlDir);
  const sqlFiles = entries.filter((entry) => entry.endsWith('.sql')).sort();

  if (!sqlFiles.length) {
    throw new Error(`No se encontraron archivos SQL en ${sqlDir}`);
  }

  for (const fileName of sqlFiles) {
    const filePath = path.join(sqlDir, fileName);
    const sql = await fs.readFile(filePath, 'utf8');
    console.log(`Applying ${fileName}...`);
    await query(sql);
  }

  console.log(`Applied ${sqlFiles.length} SQL file(s).`);
}

main()
  .catch((error) => {
    console.error('Database bootstrap failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

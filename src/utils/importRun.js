const crypto = require('crypto');
const fs = require('fs');

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });

  return hash.digest('hex');
}

async function createImportRun(client, payload) {
  const result = await client.query(
    `
      insert into raw.import_runs (
        source_kind,
        source_name,
        source_path,
        source_hash,
        status,
        metadata
      )
      values ($1, $2, $3, $4, 'started', $5::jsonb)
      returning import_run_id
    `,
    [
      payload.sourceKind,
      payload.sourceName,
      payload.sourcePath,
      payload.sourceHash,
      JSON.stringify(payload.metadata || {}),
    ],
  );

  return result.rows[0].import_run_id;
}

async function completeImportRun(client, importRunId, stats = {}) {
  await client.query(
    `
      update raw.import_runs
         set status = 'completed',
             finished_at = now(),
             rows_read = $2,
             rows_loaded = $3,
             notes = $4,
             metadata = metadata || $5::jsonb
       where import_run_id = $1
    `,
    [
      importRunId,
      stats.rowsRead || 0,
      stats.rowsLoaded || 0,
      stats.notes || null,
      JSON.stringify(stats.metadata || {}),
    ],
  );
}

async function failImportRun(client, importRunId, error) {
  if (!importRunId) {
    return;
  }

  await client.query(
    `
      update raw.import_runs
         set status = 'failed',
             finished_at = now(),
             notes = left($2, 3000)
       where import_run_id = $1
    `,
    [importRunId, error instanceof Error ? error.message : String(error)],
  );
}

module.exports = {
  completeImportRun,
  createImportRun,
  failImportRun,
  hashFile,
};

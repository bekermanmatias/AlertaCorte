const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { closePool, withClient } = require('../config/db');
const { completeImportRun, createImportRun, failImportRun, hashFile } = require('../utils/importRun');
const { normalizeText, safeInteger, safeNumeric } = require('../utils/normalize');

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split('=');
    const nextValue = inlineValue !== undefined ? inlineValue : argv[index + 1];
    if (inlineValue === undefined && argv[index + 1] && !argv[index + 1].startsWith('--')) {
      index += 1;
    }

    options[rawKey] = nextValue === undefined ? true : nextValue;
  }

  return options;
}

function resolveFilePath(options) {
  const candidate =
    options.file ||
    process.env.ENRE_SQL_DUMP_PATH ||
    path.join('data', 'raw', 'datosenre.sql');

  return path.resolve(process.cwd(), candidate);
}

function normalizeSqlScalar(rawValue, wasQuoted) {
  if (wasQuoted) {
    return rawValue;
  }

  const trimmed = rawValue.trim();
  if (!trimmed.length || trimmed.toUpperCase() === 'NULL') {
    return null;
  }

  return trimmed;
}

function parseMysqlValuesSegment(segment) {
  const rows = [];
  let currentRow = null;
  let fieldBuffer = '';
  let inQuote = false;
  let escapeNext = false;
  let fieldWasQuoted = false;

  function flushField() {
    if (!currentRow) {
      return;
    }

    currentRow.push(normalizeSqlScalar(fieldBuffer, fieldWasQuoted));
    fieldBuffer = '';
    fieldWasQuoted = false;
  }

  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index];

    if (inQuote) {
      if (escapeNext) {
        switch (char) {
          case 'n':
            fieldBuffer += '\n';
            break;
          case 'r':
            fieldBuffer += '\r';
            break;
          case 't':
            fieldBuffer += '\t';
            break;
          default:
            fieldBuffer += char;
            break;
        }
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === "'") {
        inQuote = false;
        continue;
      }

      fieldBuffer += char;
      continue;
    }

    if (char === "'") {
      inQuote = true;
      fieldWasQuoted = true;
      continue;
    }

    if (char === '(') {
      currentRow = [];
      fieldBuffer = '';
      fieldWasQuoted = false;
      continue;
    }

    if (char === ',') {
      if (currentRow) {
        flushField();
      }
      continue;
    }

    if (char === ')') {
      if (currentRow) {
        flushField();
        rows.push(currentRow);
        currentRow = null;
      }
      continue;
    }

    if (char === ';') {
      break;
    }

    if (currentRow) {
      fieldBuffer += char;
    }
  }

  return rows;
}

function parseArgentinaTimestamp(value) {
  const text = normalizeText(value);
  if (!text || text.toLowerCase() === 'sin datos') {
    return null;
  }

  const isoBase = text.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}$/i.test(isoBase)) {
    return `${isoBase}:00-03:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}$/i.test(isoBase)) {
    return `${isoBase}-03:00`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseEnreRow(values, sourceChunk, sourceRowNumber) {
  if (values.length !== 13) {
    return null;
  }

  const [
    sourceId,
    latitud,
    longitud,
    nn,
    tipo,
    empresa,
    partido,
    localidad,
    subestacion,
    alimentador,
    afectados,
    normalizacionEstimadaRaw,
    observedAtRaw,
  ] = values;

  const normalizedSchedule = normalizeText(normalizacionEstimadaRaw);

  return {
    sourceChunk,
    sourceRowNumber,
    sourceId: safeInteger(sourceId),
    latitud: safeNumeric(latitud),
    longitud: safeNumeric(longitud),
    nn: normalizeText(nn),
    tipo: normalizeText(tipo),
    empresa: normalizeText(empresa),
    partido: normalizeText(partido),
    localidad: normalizeText(localidad),
    subestacion: normalizeText(subestacion),
    alimentador: normalizeText(alimentador),
    afectados: safeInteger(afectados),
    normalizacionEstimadaRaw: normalizedSchedule,
    normalizacionEstimada: parseArgentinaTimestamp(normalizedSchedule),
    observedAt: parseArgentinaTimestamp(observedAtRaw),
    hasMissingSchedule: normalizedSchedule === 'Sin Datos',
  };
}

async function insertEnreBatch(client, importRunId, rows) {
  if (!rows.length) {
    return;
  }

  const values = [];
  const placeholders = rows.map((row, rowIndex) => {
    const offset = rowIndex * 18;
    values.push(
      importRunId,
      row.sourceChunk,
      row.sourceRowNumber,
      row.sourceId,
      row.latitud,
      row.longitud,
      row.nn,
      row.tipo,
      row.empresa,
      row.partido,
      row.localidad,
      row.subestacion,
      row.alimentador,
      row.afectados,
      row.normalizacionEstimadaRaw,
      row.normalizacionEstimada,
      row.observedAt,
      row.hasMissingSchedule,
    );

    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18})`;
  });

  await client.query(
    `
      insert into staging.enre_cortes_sector (
        import_run_id,
        source_chunk,
        source_row_number,
        source_id,
        latitud,
        longitud,
        nn,
        tipo,
        empresa,
        partido,
        localidad,
        subestacion,
        alimentador,
        afectados,
        normalizacion_estimada_raw,
        normalizacion_estimada,
        observed_at,
        has_missing_schedule
      )
      values ${placeholders.join(',\n')}
    `,
    values,
  );
}

async function materializeEnreFacts(client, importRunId) {
  await client.query(
    `
      insert into analytics.dim_sector_geo (
        sector_geo_key,
        empresa,
        partido,
        localidad,
        subestacion,
        alimentador,
        nn,
        canonical_name
      )
      select distinct
        lower(concat_ws(
          '||',
          coalesce(nullif(trim(s.empresa), ''), '__null__'),
          coalesce(nullif(trim(s.partido), ''), '__null__'),
          coalesce(nullif(trim(s.localidad), ''), '__null__'),
          coalesce(nullif(trim(s.subestacion), ''), '__null__'),
          coalesce(nullif(trim(s.alimentador), ''), '__null__'),
          coalesce(nullif(trim(s.nn), ''), '__null__')
        )) as sector_geo_key,
        s.empresa,
        s.partido,
        s.localidad,
        s.subestacion,
        s.alimentador,
        s.nn,
        concat_ws(' / ', s.empresa, s.partido, s.localidad, s.subestacion, s.alimentador)
      from staging.enre_cortes_sector s
      where s.import_run_id = $1
      on conflict (sector_geo_key) do update
      set empresa = excluded.empresa,
          partido = excluded.partido,
          localidad = excluded.localidad,
          subestacion = excluded.subestacion,
          alimentador = excluded.alimentador,
          nn = excluded.nn,
          canonical_name = excluded.canonical_name
    `,
    [importRunId],
  );

  await client.query(
    `
      insert into analytics.fact_cortes_sector (
        import_run_id,
        staging_enre_id,
        sector_geo_id,
        region_id,
        fecha,
        observed_at,
        normalizacion_estimada,
        nn,
        tipo,
        empresa,
        afectados,
        has_missing_schedule
      )
      select
        s.import_run_id,
        s.staging_enre_id,
        g.sector_geo_id,
        m.region_id,
        coalesce(
          (s.observed_at at time zone 'America/Argentina/Buenos_Aires')::date,
          (s.normalizacion_estimada at time zone 'America/Argentina/Buenos_Aires')::date
        ) as fecha,
        s.observed_at,
        s.normalizacion_estimada,
        s.nn,
        s.tipo,
        s.empresa,
        s.afectados,
        s.has_missing_schedule
      from staging.enre_cortes_sector s
      join analytics.dim_sector_geo g
        on g.sector_geo_key = lower(concat_ws(
          '||',
          coalesce(nullif(trim(s.empresa), ''), '__null__'),
          coalesce(nullif(trim(s.partido), ''), '__null__'),
          coalesce(nullif(trim(s.localidad), ''), '__null__'),
          coalesce(nullif(trim(s.subestacion), ''), '__null__'),
          coalesce(nullif(trim(s.alimentador), ''), '__null__'),
          coalesce(nullif(trim(s.nn), ''), '__null__')
        ))
      left join analytics.region_sector_map m
        on m.sector_geo_id = g.sector_geo_id
      where s.import_run_id = $1
        and coalesce(s.observed_at, s.normalizacion_estimada) is not null
    `,
    [importRunId],
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const filePath = resolveFilePath(options);
  const fileHash = await hashFile(filePath);
  const batchSize = Number.parseInt(options.batchSize || '500', 10);
  let importRunId;

  await withClient(async (client) => {
    importRunId = await createImportRun(client, {
      sourceKind: 'enre',
      sourceName: path.basename(filePath),
      sourcePath: filePath,
      sourceHash: fileHash,
      metadata: {
        tableName: 'detalle_cortes_bk',
        batchSize,
      },
    });

    let sourceChunk = 0;
    let sourceRowNumber = 0;
    let rowsRead = 0;
    let rowsLoaded = 0;
    let stagedBatch = [];
    let analyticsTransactionStarted = false;
    let currentInsertStatement = '';

    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const lineReader = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of lineReader) {
        const trimmedLine = line.trim();

        if (!currentInsertStatement && !trimmedLine.startsWith('INSERT INTO `detalle_cortes_bk` VALUES ')) {
          continue;
        }

        currentInsertStatement += trimmedLine;
        if (!trimmedLine.endsWith(';')) {
          continue;
        }

        sourceChunk += 1;
        const valuesSegment = currentInsertStatement.slice('INSERT INTO `detalle_cortes_bk` VALUES '.length);
        currentInsertStatement = '';
        const parsedRows = parseMysqlValuesSegment(valuesSegment);

        for (const rawRow of parsedRows) {
          sourceRowNumber += 1;
          rowsRead += 1;

          const row = parseEnreRow(rawRow, sourceChunk, sourceRowNumber);
          if (!row) {
            continue;
          }

          stagedBatch.push(row);

          if (stagedBatch.length >= batchSize) {
            await insertEnreBatch(client, importRunId, stagedBatch);
            rowsLoaded += stagedBatch.length;
            stagedBatch = [];
          }
        }
      }

      if (stagedBatch.length) {
        await insertEnreBatch(client, importRunId, stagedBatch);
        rowsLoaded += stagedBatch.length;
      }

      await client.query('begin');
      analyticsTransactionStarted = true;
      await materializeEnreFacts(client, importRunId);
      await client.query('commit');
      analyticsTransactionStarted = false;

      await completeImportRun(client, importRunId, {
        rowsRead,
        rowsLoaded,
        notes: 'Dump ENRE parseado a staging y analytics.',
      });
    } catch (error) {
      try {
        if (!analyticsTransactionStarted) {
          throw new Error('skip rollback');
        }

        await client.query('rollback');
      } catch (rollbackError) {
        if (rollbackError.message !== 'skip rollback') {
          console.error('No se pudo revertir la transaccion de analytics:', rollbackError);
        }
      }

      await failImportRun(client, importRunId, error);
      throw error;
    } finally {
      lineReader.close();
    }
  });

  console.log(`ENRE importado correctamente. Import run ID: ${importRunId}`);
}

main()
  .catch((error) => {
    console.error('Fallo la importacion de ENRE:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

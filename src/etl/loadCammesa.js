const path = require('path');

const XLSX = require('@e965/xlsx');

const { closePool, withClient } = require('../config/db');
const { completeImportRun, createImportRun, failImportRun, hashFile } = require('../utils/importRun');
const { monthLabelFromDate, normalizeKey, normalizeText, safeInteger, safeNumeric, toIsoDate } = require('../utils/normalize');

const HEADER_CANDIDATES = {
  anio: ['ano'],
  mes: ['mes'],
  fecha: ['fecha'],
  tipo_dia: ['tipo_dia'],
  gran_bsas: ['gran_bs_as', 'gran_bs_as_'],
  buenos_aires: ['buenos_aires'],
  centro: ['centro'],
  litoral: ['litoral'],
  cuyo: ['cuyo'],
  noroeste: ['noroeste'],
  noreste: ['noreste'],
  comahue: ['comahue'],
  patagonica: ['patagonica'],
  demanda_total: ['demanda_total'],
  temperatura_media_c: ['temperatura_referencia_media_gba_c', 'temperatura_referencia_media_bsa_c'],
};

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
    process.env.CAMMESA_FILE_PATH ||
    path.join('data', 'raw', 'cammesa_consumo_historico.xlsx');

  return path.resolve(process.cwd(), candidate);
}

function resolveSheetName(workbook, requestedSheet) {
  if (!requestedSheet) {
    return workbook.SheetNames[0];
  }

  if (workbook.SheetNames.includes(requestedSheet)) {
    return requestedSheet;
  }

  const requestedKey = normalizeKey(requestedSheet);
  const normalizedMatch = workbook.SheetNames.find((sheetName) => normalizeKey(sheetName) === requestedKey);
  if (normalizedMatch) {
    return normalizedMatch;
  }

  throw new Error(`La hoja "${requestedSheet}" no existe en el archivo de CAMMESA.`);
}

function buildHeaderIndex(headerRow) {
  const normalizedHeader = headerRow.map((value) => normalizeKey(value));
  const indexMap = {};

  for (const [targetField, candidates] of Object.entries(HEADER_CANDIDATES)) {
    const foundIndex = normalizedHeader.findIndex((header) => candidates.includes(header));
    if (foundIndex === -1) {
      throw new Error(`No se encontro la columna requerida de CAMMESA para "${targetField}".`);
    }

    indexMap[targetField] = foundIndex;
  }

  return indexMap;
}

function getHeaderRowIndex(rows) {
  const index = rows.findIndex((row) => {
    const normalized = row.map((value) => normalizeKey(value));
    return normalized.includes('fecha') && normalized.includes('demanda_total');
  });

  if (index === -1) {
    throw new Error('No se pudo detectar la fila de encabezados del archivo CAMMESA.');
  }

  return index;
}

function parseCammesaRow(row, rowNumber, headerIndex) {
  const fecha = toIsoDate(row[headerIndex.fecha]);
  if (!fecha) {
    return null;
  }

  const mesValue = row[headerIndex.mes];
  const mesLabel =
    typeof mesValue === 'string' && /[A-Za-z]/.test(mesValue)
      ? normalizeText(mesValue)
      : monthLabelFromDate(fecha);

  return {
    sourceRowNumber: rowNumber,
    anio: safeInteger(row[headerIndex.anio]) || Number.parseInt(fecha.slice(0, 4), 10),
    mesLabel,
    fecha,
    tipoDia: normalizeText(row[headerIndex.tipo_dia]) || 'Sin clasificar',
    granBsas: safeNumeric(row[headerIndex.gran_bsas]),
    buenosAires: safeNumeric(row[headerIndex.buenos_aires]),
    centro: safeNumeric(row[headerIndex.centro]),
    litoral: safeNumeric(row[headerIndex.litoral]),
    cuyo: safeNumeric(row[headerIndex.cuyo]),
    noroeste: safeNumeric(row[headerIndex.noroeste]),
    noreste: safeNumeric(row[headerIndex.noreste]),
    comahue: safeNumeric(row[headerIndex.comahue]),
    patagonica: safeNumeric(row[headerIndex.patagonica]),
    demandaTotal: safeNumeric(row[headerIndex.demanda_total]),
    temperaturaMediaC: safeNumeric(row[headerIndex.temperatura_media_c]),
  };
}

async function insertCammesaBatch(client, importRunId, records) {
  if (!records.length) {
    return;
  }

  const values = [];
  const placeholders = records.map((record, recordIndex) => {
    const offset = recordIndex * 17;
    values.push(
      importRunId,
      record.sourceRowNumber,
      record.anio,
      record.mesLabel,
      record.fecha,
      record.tipoDia,
      record.granBsas,
      record.buenosAires,
      record.centro,
      record.litoral,
      record.cuyo,
      record.noroeste,
      record.noreste,
      record.comahue,
      record.patagonica,
      record.demandaTotal,
      record.temperaturaMediaC,
    );

    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17})`;
  });

  await client.query(
    `
      insert into staging.cammesa_demanda_diaria (
        import_run_id,
        source_row_number,
        anio,
        mes_label,
        fecha,
        tipo_dia,
        gran_bsas,
        buenos_aires,
        centro,
        litoral,
        cuyo,
        noroeste,
        noreste,
        comahue,
        patagonica,
        demanda_total,
        temperatura_media_c
      )
      values ${placeholders.join(',\n')}
    `,
    values,
  );
}

async function materializeCammesaFacts(client, importRunId) {
  await client.query(
    `
      insert into analytics.fact_demanda_diaria (
        import_run_id,
        staging_cammesa_id,
        region_id,
        fecha,
        anio,
        mes_numero,
        tipo_dia,
        demanda_mw,
        demanda_total_mw,
        temperatura_media_c
      )
      select
        s.import_run_id,
        s.staging_cammesa_id,
        r.region_id,
        s.fecha,
        s.anio,
        extract(month from s.fecha)::smallint,
        s.tipo_dia,
        pivot.demanda_mw,
        s.demanda_total,
        s.temperatura_media_c
      from staging.cammesa_demanda_diaria s
      cross join lateral (
        values
          ('gran_bsas', s.gran_bsas),
          ('buenos_aires', s.buenos_aires),
          ('centro', s.centro),
          ('litoral', s.litoral),
          ('cuyo', s.cuyo),
          ('noroeste', s.noroeste),
          ('noreste', s.noreste),
          ('comahue', s.comahue),
          ('patagonica', s.patagonica)
      ) as pivot(region_code, demanda_mw)
      join analytics.dim_region r on r.region_code = pivot.region_code
      where s.import_run_id = $1
        and pivot.demanda_mw is not null
    `,
    [importRunId],
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const filePath = resolveFilePath(options);
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = resolveSheetName(workbook, options.sheet || process.env.CAMMESA_SHEET);
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  const headerRowIndex = getHeaderRowIndex(rows);
  const headerIndex = buildHeaderIndex(rows[headerRowIndex]);
  const parsedRows = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const parsed = parseCammesaRow(rows[rowIndex], rowIndex + 1, headerIndex);
    if (parsed) {
      parsedRows.push(parsed);
    }
  }

  if (!parsedRows.length) {
    throw new Error('No se encontraron filas validas para importar desde CAMMESA.');
  }

  const fileHash = await hashFile(filePath);
  let importRunId;

  await withClient(async (client) => {
    importRunId = await createImportRun(client, {
      sourceKind: 'cammesa',
      sourceName: path.basename(filePath),
      sourcePath: filePath,
      sourceHash: fileHash,
      metadata: {
        sheetName,
        totalRowsInSheet: rows.length,
      },
    });

    try {
      await client.query('begin');

      const batchSize = 250;
      for (let index = 0; index < parsedRows.length; index += batchSize) {
        const batch = parsedRows.slice(index, index + batchSize);
        await insertCammesaBatch(client, importRunId, batch);
      }

      await materializeCammesaFacts(client, importRunId);
      await client.query('commit');

      await completeImportRun(client, importRunId, {
        rowsRead: parsedRows.length,
        rowsLoaded: parsedRows.length,
        notes: `Hoja importada: ${sheetName}`,
      });
    } catch (error) {
      await client.query('rollback');
      await failImportRun(client, importRunId, error);
      throw error;
    }
  });

  console.log(`CAMMESA importada correctamente. Import run ID: ${importRunId}`);
  console.log(`Filas procesadas: ${parsedRows.length}`);
}

main()
  .catch((error) => {
    console.error('Fallo la importacion de CAMMESA:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

/**
 * Completa dataset_modelo_predictivo_final_con_alerta.csv con dias faltantes
 * entre la primera y ultima fecha existentes, usando CAMMESA (alerta=0 en dias nuevos).
 */
const fs = require('fs');
const path = require('path');

const XLSX = require('@e965/xlsx');

const { normalizeKey, normalizeText, safeNumeric, toIsoDate } = require('../src/utils/normalize');

const DATASET_PATH = path.resolve(
  process.cwd(),
  'data/processed/dataset_modelo_predictivo_final_con_alerta.csv',
);
const CAMMESA_PATH = path.resolve(
  process.cwd(),
  process.env.CAMMESA_FILE_PATH || 'data/raw/cammesa_consumo_historico.xlsx',
);
const CAMMESA_SHEET = process.env.CAMMESA_SHEET || 'Datos Región';

const HEADER = [
  'Fecha',
  'Fecha_dt',
  'Tipo_Dia',
  'Temperatura_Media_GBA',
  'Demanda_Dia_Anterior',
  'Mes_Estacional',
  'Demanda_Actual',
  'Cantidad_Cortes',
  'Total_Usuarios_Afectados',
  'Alerta_Corte',
];

function parseCsvLine(line) {
  return line.split(';').map((cell) => cell.trim());
}

function parseDatasetDate(value) {
  const match = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3];
  return `${year}-${month}-${day}`;
}

function formatDatasetDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function encodeTipoDia(tipoText) {
  const text = String(tipoText || '').toLowerCase();
  const esHabil = /habil/.test(text) && !/semilaborable/.test(text);
  return esHabil ? 1 : 0;
}

function formatNumber(value, decimals = 1) {
  if (value == null || !Number.isFinite(value)) {
    return '';
  }

  return Number(value).toFixed(decimals);
}

function loadExistingRows() {
  const raw = fs.readFileSync(DATASET_PATH, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const byDate = new Map();

  for (const line of lines) {
    const cells = parseCsvLine(line);
    if (!cells[0] || cells[0] === 'Fecha') {
      continue;
    }

    const isoDate = parseDatasetDate(cells[0]);
    if (!isoDate) {
      continue;
    }

    byDate.set(isoDate, cells);
  }

  return byDate;
}

function loadCammesaByDate() {
  const workbook = XLSX.readFile(CAMMESA_PATH);
  const sheetName = workbook.SheetNames.includes(CAMMESA_SHEET)
    ? CAMMESA_SHEET
    : workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null });
  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map((value) => normalizeKey(value));
    return normalized.includes('fecha') && normalized.includes('gran_bs_as');
  });

  if (headerIndex === -1) {
    throw new Error('No se encontraron encabezados de CAMMESA (fecha / gran bsas).');
  }

  const headerRow = rows[headerIndex].map((value) => normalizeKey(value));
  const fechaIdx = headerRow.indexOf('fecha');
  const tipoIdx = headerRow.indexOf('tipo_dia');
  const granIdx = headerRow.indexOf('gran_bs_as');
  const tempIdx = headerRow.findIndex((key) => key.includes('temperatura'));

  const byDate = new Map();

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const isoDate = toIsoDate(row[fechaIdx]);
    if (!isoDate) {
      continue;
    }

    byDate.set(isoDate, {
      fecha: isoDate,
      tipoDia: normalizeText(row[tipoIdx]) || 'Sin clasificar',
      demandaMw: safeNumeric(row[granIdx]),
      temperatura: safeNumeric(row[tempIdx]),
    });
  }

  return byDate;
}

function listDatesBetween(minIso, maxIso) {
  const dates = [];
  const cursor = new Date(`${minIso}T00:00:00Z`);
  const end = new Date(`${maxIso}T00:00:00Z`);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function buildRowFromCammesa(isoDate, cammesa, demandaAnterior) {
  const fecha = formatDatasetDate(isoDate);
  const mes = Number(isoDate.slice(5, 7));

  return [
    fecha,
    fecha,
    String(encodeTipoDia(cammesa.tipoDia)),
    formatNumber(cammesa.temperatura, 1),
    formatNumber(demandaAnterior, 1),
    String(mes),
    formatNumber(cammesa.demandaMw, 1),
    '0',
    '0',
    '0',
  ];
}

function main() {
  const existingByDate = loadExistingRows();
  const cammesaByDate = loadCammesaByDate();

  if (!existingByDate.size) {
    throw new Error('El CSV no tiene filas con fechas validas.');
  }

  const sortedExisting = [...existingByDate.keys()].sort();
  const minDate = sortedExisting[0];
  const maxDate = sortedExisting[sortedExisting.length - 1];
  const allDates = listDatesBetween(minDate, maxDate);

  const outputRows = [];
  let added = 0;
  let kept = 0;
  let skippedNoCammesa = 0;

  for (const isoDate of allDates) {
    if (existingByDate.has(isoDate)) {
      outputRows.push(existingByDate.get(isoDate));
      kept += 1;
      continue;
    }

    const cammesa = cammesaByDate.get(isoDate);
    if (!cammesa || cammesa.demandaMw == null) {
      skippedNoCammesa += 1;
      continue;
    }

    const previousIso = new Date(`${isoDate}T00:00:00Z`);
    previousIso.setUTCDate(previousIso.getUTCDate() - 1);
    const previousKey = previousIso.toISOString().slice(0, 10);
    const previousCammesa = cammesaByDate.get(previousKey);
    const demandaAnterior = previousCammesa?.demandaMw;

    if (demandaAnterior == null) {
      skippedNoCammesa += 1;
      continue;
    }

    outputRows.push(buildRowFromCammesa(isoDate, cammesa, demandaAnterior));
    added += 1;
  }

  const lines = [HEADER.join(';'), ...outputRows.map((row) => row.join(';'))];
  fs.writeFileSync(DATASET_PATH, `${lines.join('\n')}\n`, 'utf8');

  console.log(`[Dataset] Rango: ${formatDatasetDate(minDate)} -> ${formatDatasetDate(maxDate)}`);
  console.log(`[Dataset] Filas conservadas (con alerta ENRE): ${kept}`);
  console.log(`[Dataset] Filas nuevas (alerta=0, CAMMESA): ${added}`);
  console.log(`[Dataset] Dias omitidos (sin CAMMESA/demanda anterior): ${skippedNoCammesa}`);
  console.log(`[Dataset] Total filas: ${outputRows.length}`);
  console.log(`[Dataset] Guardado: ${DATASET_PATH}`);
}

main();

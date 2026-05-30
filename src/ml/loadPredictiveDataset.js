const fs = require('fs');

const { addDerivedFeatures, BASE_INPUT_COLUMNS, INPUT_COLUMNS } = require('./derivedFeatures');

const OUTPUT_COLUMN = 'Alerta_Corte';

function parseDatasetDate(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3];
  return `${year}-${month}-${day}`;
}

function parseNumber(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsvLine(line, delimiter) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function loadPredictiveDataset(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error(`El CSV no tiene filas de datos: ${filePath}`);
  }

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = parseCsvLine(lines[0], delimiter).map((header) => header.trim());

  for (const column of [...BASE_INPUT_COLUMNS, OUTPUT_COLUMN]) {
    if (!headers.includes(column)) {
      throw new Error(`Columna requerida ausente "${column}" en ${filePath}`);
    }
  }

  const columnIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
  const rows = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = parseCsvLine(lines[lineIndex], delimiter);
    if (cells.length < headers.length) {
      continue;
    }

    const input = {};
    let valid = true;

    for (const column of BASE_INPUT_COLUMNS) {
      const value = parseNumber(cells[columnIndex[column]]);
      if (value == null) {
        valid = false;
        break;
      }
      input[column] = value;
    }

    const alerta = parseNumber(cells[columnIndex[OUTPUT_COLUMN]]);
    if (!valid || alerta == null || (alerta !== 0 && alerta !== 1)) {
      continue;
    }

    const fecha =
      parseDatasetDate(cells[columnIndex.Fecha]) ||
      parseDatasetDate(cells[columnIndex.Fecha_dt]);

    rows.push({
      fecha,
      input: addDerivedFeatures(input),
      output: { [OUTPUT_COLUMN]: alerta },
      meta: { fecha },
    });
  }

  if (!rows.length) {
    throw new Error(`No se pudieron parsear filas validas desde ${filePath}`);
  }

  return {
    rows,
    inputColumns: INPUT_COLUMNS,
    outputColumn: OUTPUT_COLUMN,
  };
}

module.exports = {
  BASE_INPUT_COLUMNS,
  INPUT_COLUMNS,
  OUTPUT_COLUMN,
  loadPredictiveDataset,
};

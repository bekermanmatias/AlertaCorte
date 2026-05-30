require('dotenv').config();

const fs = require('fs');
const path = require('path');

const DATASET_PATH = path.resolve(
  process.cwd(),
  process.env.ML_DATASET_PATH || 'data/processed/dataset_modelo_predictivo_final_con_alerta.csv',
);

const REQUIRED_COLUMNS = [
  'Temperatura_Media_GBA',
  'Demanda_Dia_Anterior',
  'Mes_Estacional',
  'Cantidad_Cortes',
  'Total_Usuarios_Afectados',
  'Alerta_Corte',
];

function parseNumber(value) {
  const parsed = Number.parseFloat(String(value ?? '').trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function detectDelimiter(headerLine) {
  return headerLine.includes(';') ? ';' : ',';
}

function parseRows(raw) {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    throw new Error(`El dataset no tiene filas suficientes: ${DATASET_PATH}`);
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map((header) => header.trim());
  const columnIndex = Object.fromEntries(headers.map((header, index) => [header, index]));

  for (const column of REQUIRED_COLUMNS) {
    if (columnIndex[column] == null) {
      throw new Error(`Columna requerida ausente "${column}" en ${DATASET_PATH}`);
    }
  }

  const rows = lines.slice(1).map((line) => line.split(delimiter));
  return { delimiter, headers, columnIndex, rows };
}

function computeAlert(row, columnIndex) {
  const temperatura = parseNumber(row[columnIndex.Temperatura_Media_GBA]);
  const demandaAnterior = parseNumber(row[columnIndex.Demanda_Dia_Anterior]);
  const mes = parseNumber(row[columnIndex.Mes_Estacional]);
  const cortes = parseNumber(row[columnIndex.Cantidad_Cortes]) || 0;
  const usuarios = parseNumber(row[columnIndex.Total_Usuarios_Afectados]) || 0;

  const temporadaCalida = [12, 1, 2, 3].includes(mes);
  const primaveraCalida = [10, 11].includes(mes);
  const calorCritico = temporadaCalida && temperatura >= 30 && demandaAnterior >= 5_800;
  const calorMuyAlto = temporadaCalida && temperatura >= 32;
  const calorPrimavera = primaveraCalida && temperatura >= 31 && demandaAnterior >= 5_800;
  const eventoSevero = usuarios >= 250_000 || cortes >= 5_000;
  const eventoExtremo = usuarios >= 1_000_000 || cortes >= 20_000;
  const estresPorCalor = temperatura >= 29 && demandaAnterior >= 7_000;
  const estresPorDemanda = demandaAnterior >= 8_500;
  const estresEstacional = temporadaCalida && temperatura >= 27 && demandaAnterior >= 6_800;

  return calorCritico ||
    calorMuyAlto ||
    calorPrimavera ||
    eventoExtremo ||
    (eventoSevero && (estresPorCalor || estresPorDemanda || estresEstacional))
    ? 1
    : 0;
}

function summarize(rows, columnIndex, label) {
  const total = rows.length;
  const positives = rows.reduce(
    (sum, row) => sum + (parseNumber(row[columnIndex.Alerta_Corte]) === 1 ? 1 : 0),
    0,
  );

  console.log(
    `[Relabel] ${label}: ${positives}/${total} alertas (${((positives / total) * 100).toFixed(1)}%)`,
  );

  for (const mes of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    const monthRows = rows.filter((row) => parseNumber(row[columnIndex.Mes_Estacional]) === mes);
    const monthPositives = monthRows.reduce(
      (sum, row) => sum + (parseNumber(row[columnIndex.Alerta_Corte]) === 1 ? 1 : 0),
      0,
    );
    const rate = monthRows.length ? (monthPositives / monthRows.length) * 100 : 0;
    console.log(
      `[Relabel]   Mes ${String(mes).padStart(2, '0')}: ${monthPositives}/${monthRows.length} (${rate.toFixed(1)}%)`,
    );
  }
}

function main() {
  const raw = fs.readFileSync(DATASET_PATH, 'utf8');
  const { delimiter, headers, columnIndex, rows } = parseRows(raw);
  const backupPath = DATASET_PATH.replace(/\.csv$/i, `.backup-${Date.now()}.csv`);

  summarize(rows, columnIndex, 'antes');

  let changed = 0;
  for (const row of rows) {
    const previous = parseNumber(row[columnIndex.Alerta_Corte]);
    const next = computeAlert(row, columnIndex);
    if (previous !== next) {
      changed += 1;
    }
    row[columnIndex.Alerta_Corte] = String(next);
  }

  summarize(rows, columnIndex, 'despues');

  fs.copyFileSync(DATASET_PATH, backupPath);
  fs.writeFileSync(DATASET_PATH, `${headers.join(delimiter)}\n${rows.map((row) => row.join(delimiter)).join('\n')}\n`, 'utf8');

  console.log(`[Relabel] Filas re-etiquetadas: ${changed}`);
  console.log(`[Relabel] Backup: ${backupPath}`);
  console.log(`[Relabel] Dataset actualizado: ${DATASET_PATH}`);
}

main();

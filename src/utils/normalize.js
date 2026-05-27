const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function stripAccents(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeKey(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim().replace(/\s+/g, ' ');
  return text.length ? text : null;
}

function safeInteger(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = String(value).replace(/\./g, '').replace(',', '.').trim();
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function safeNumeric(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = String(value)
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function excelSerialToDate(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  if (typeof value === 'number') {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const milliseconds = Math.round(value * 24 * 60 * 60 * 1000);
    return new Date(excelEpoch + milliseconds);
  }

  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())) {
    return excelSerialToDate(Number.parseFloat(value));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

function toIsoDate(value) {
  const date = excelSerialToDate(value);
  if (!date) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function monthLabelFromDate(isoDate) {
  if (!isoDate) {
    return null;
  }

  const date = new Date(`${isoDate}T00:00:00Z`);
  const month = MONTH_LABELS[date.getUTCMonth()];
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${month}-${year}`;
}

function buildSectorGeoKey(parts) {
  return parts
    .map((part) => normalizeText(part) ?? '__null__')
    .join('||')
    .toLowerCase();
}

module.exports = {
  buildSectorGeoKey,
  excelSerialToDate,
  monthLabelFromDate,
  normalizeKey,
  normalizeText,
  safeInteger,
  safeNumeric,
  stripAccents,
  toIsoDate,
};

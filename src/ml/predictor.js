const fs = require('fs/promises');
const brain = require('brain.js');

const { resolveMlConfig } = require('./config');
const { scaleInput } = require('./featureScaler');
const { INPUT_COLUMNS } = require('./loadPredictiveDataset');

const FIELD_ALIASES = {
  Tipo_Dia: ['tipo_dia', 'tipoDia', 'Tipo_Dia'],
  Temperatura_Media_GBA: ['temperatura_media_gba', 'temperatura', 'Temperatura_Media_GBA'],
  Demanda_Dia_Anterior: ['demanda_dia_anterior', 'demanda', 'Demanda_Dia_Anterior'],
  Mes_Estacional: ['mes_estacional', 'mes', 'Mes_Estacional'],
};

let cachedModel = null;

function parseNumber(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function readField(body, canonicalName) {
  const keys = FIELD_ALIASES[canonicalName] || [canonicalName];

  for (const key of keys) {
    if (body[key] != null && body[key] !== '') {
      return parseNumber(body[key]);
    }
  }

  return null;
}

function normalizeInput(body) {
  const input = {};
  const errors = [];

  const tipoDia = readField(body, 'Tipo_Dia');
  if (tipoDia == null || (tipoDia !== 0 && tipoDia !== 1)) {
    errors.push('Tipo_Dia debe ser 0 (no laborable) o 1 (habil).');
  } else {
    input.Tipo_Dia = tipoDia;
  }

  const temperatura = readField(body, 'Temperatura_Media_GBA');
  if (temperatura == null || temperatura < -30 || temperatura > 55) {
    errors.push('Temperatura_Media_GBA debe ser un numero entre -30 y 55.');
  } else {
    input.Temperatura_Media_GBA = temperatura;
  }

  const demanda = readField(body, 'Demanda_Dia_Anterior');
  if (demanda == null || demanda <= 0) {
    errors.push('Demanda_Dia_Anterior debe ser un numero mayor a 0.');
  } else {
    input.Demanda_Dia_Anterior = demanda;
  }

  const mes = readField(body, 'Mes_Estacional');
  if (mes == null || mes < 1 || mes > 12) {
    errors.push('Mes_Estacional debe ser un entero entre 1 y 12.');
  } else {
    input.Mes_Estacional = Math.round(mes);
  }

  if (errors.length) {
    const error = new Error(errors.join(' '));
    error.statusCode = 400;
    throw error;
  }

  return input;
}

async function loadModel(modelPath) {
  if (cachedModel && cachedModel.modelPath === modelPath) {
    return cachedModel;
  }

  const raw = await fs.readFile(modelPath, 'utf8');
  const artifact = JSON.parse(raw);
  const net = new brain.NeuralNetwork();
  net.fromJSON(artifact.model);

  cachedModel = {
    modelPath,
    artifact,
    net,
  };

  return cachedModel;
}

async function ensureModelReady(modelPath = resolveMlConfig().modelPath) {
  try {
    await fs.access(modelPath);
  } catch {
    const error = new Error(
      `Modelo no encontrado en ${modelPath}. Ejecuta npm run ml:train antes de predecir.`,
    );
    error.statusCode = 503;
    throw error;
  }

  return loadModel(modelPath);
}

function buildInputWarnings(input, scaler) {
  const advertencias = [];

  for (const column of INPUT_COLUMNS) {
    const bounds = scaler?.[column];
    if (!bounds) {
      continue;
    }

    const value = input[column];
    if (value < bounds.min || value > bounds.max) {
      advertencias.push(
        `${column}=${value} esta fuera del rango de entrenamiento (${bounds.min} – ${bounds.max}).`,
      );
    }
  }

  return advertencias;
}

function formatProbability(probability) {
  if (probability >= 0.995) {
    return { probabilidad: probability, probabilidad_texto: '>99 %' };
  }

  if (probability <= 0.005) {
    return { probabilidad: probability, probabilidad_texto: '<1 %' };
  }

  return {
    probabilidad: probability,
    probabilidad_texto: `${(probability * 100).toFixed(1)} %`,
  };
}

function getModelInfo(artifact, modelPath) {
  return {
    modelPath,
    inputColumns: artifact.inputColumns || INPUT_COLUMNS,
    outputColumn: artifact.outputColumn || 'Alerta_Corte',
    threshold: artifact.threshold ?? 0.5,
    hiddenLayers: artifact.hiddenLayers || [],
    savedAt: artifact.savedAt || null,
    metrics: artifact.metrics || null,
  };
}

async function predict(body, options = {}) {
  const modelPath = options.modelPath || resolveMlConfig().modelPath;
  const input = normalizeInput(body);
  const { artifact, net } = await ensureModelReady(modelPath);
  const threshold = options.threshold ?? artifact.threshold ?? 0.5;

  const scaled = scaleInput(input, artifact.scaler);
  const output = net.run(scaled);
  const outputColumn = artifact.outputColumn || 'Alerta_Corte';
  const rawProbability = Number(output[outputColumn] ?? Object.values(output)[0]);
  const probability = Math.min(1, Math.max(0, rawProbability));
  const alerta = probability >= threshold ? 1 : 0;
  const advertencias = buildInputWarnings(input, artifact.scaler);

  if (probability >= 0.995 || probability <= 0.005) {
    advertencias.push(
      'Probabilidad extrema: la red puede estar saturada. Interpretar con cautela.',
    );
  }

  const formatted = formatProbability(probability);

  return {
    input,
    ...formatted,
    alerta_corte_suministro: alerta,
    etiqueta: alerta === 1 ? 'Riesgo de corte' : 'Sin alerta',
    umbral: threshold,
    advertencias,
  };
}

async function getPredictorStatus(modelPath = resolveMlConfig().modelPath) {
  try {
    const { artifact } = await ensureModelReady(modelPath);
    return {
      ready: true,
      ...getModelInfo(artifact, modelPath),
    };
  } catch (error) {
    return {
      ready: false,
      modelPath,
      error: error.message,
    };
  }
}

function clearModelCache() {
  cachedModel = null;
}

module.exports = {
  clearModelCache,
  ensureModelReady,
  getModelInfo,
  getPredictorStatus,
  normalizeInput,
  predict,
};

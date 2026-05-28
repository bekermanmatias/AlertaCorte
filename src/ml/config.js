const path = require('path');

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseFloatEnv(value, fallback) {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveMlConfig() {
  return {
    datasetPath: path.resolve(
      process.cwd(),
      process.env.ML_DATASET_PATH || 'data/processed/dataset_modelo_predictivo_final_con_alerta.csv',
    ),
    modelPath: path.resolve(
      process.cwd(),
      process.env.ML_MODEL_PATH || 'data/processed/alertacorte-model.json',
    ),
    metricsPath: path.resolve(
      process.cwd(),
      process.env.ML_METRICS_PATH || 'data/processed/alertacorte-metrics.json',
    ),
    validationRatio: parseFloatEnv(process.env.ML_VALIDATION_RATIO, 0.2),
    threshold: parseFloatEnv(process.env.ML_PREDICTION_THRESHOLD, 0.5),
    hiddenLayers: (process.env.ML_HIDDEN_LAYERS || '8,4')
      .split(',')
      .map((layer) => parsePositiveInt(layer.trim(), 0))
      .filter((size) => size > 0),
    training: {
      iterations: parsePositiveInt(process.env.ML_TRAIN_ITERATIONS, 25_000),
      errorThresh: parseFloatEnv(process.env.ML_TRAIN_ERROR_THRESH, 0.008),
      learningRate: parseFloatEnv(process.env.ML_TRAIN_LEARNING_RATE, 0.2),
      momentum: parseFloatEnv(process.env.ML_TRAIN_MOMENTUM, 0.08),
      log: true,
      logPeriod: parsePositiveInt(process.env.ML_TRAIN_LOG_PERIOD, 1000),
    },
  };
}

module.exports = {
  parseFloatEnv,
  parsePositiveInt,
  resolveMlConfig,
};

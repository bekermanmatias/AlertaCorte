require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const brain = require('brain.js');

const { resolveMlConfig } = require('./config');
const { buildScaler, rowsToBrainData } = require('./featureScaler');
const { INPUT_COLUMNS, OUTPUT_COLUMN, loadPredictiveDataset } = require('./loadPredictiveDataset');
const { clearModelCache } = require('./predictor');
const { evaluateBinaryClassifier, findOptimalThreshold } = require('./metrics');

function resolveTrainConfig() {
  return resolveMlConfig();
}

function splitTrainValidation(rows, validationRatio, outputColumn) {
  const positives = rows.filter((row) => row.output[outputColumn] === 1);
  const negatives = rows.filter((row) => row.output[outputColumn] === 0);
  const valPosCount = Math.max(1, Math.round(positives.length * validationRatio));
  const valNegCount = Math.max(1, Math.round(negatives.length * validationRatio));

  const shuffle = (items) => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  };

  const valPos = shuffle(positives).slice(0, valPosCount);
  const valNeg = shuffle(negatives).slice(0, valNegCount);
  const valKeys = new Set([...valPos, ...valNeg]);

  const validationRows = [...valPos, ...valNeg].sort((left, right) =>
    String(left.meta?.fecha || '').localeCompare(String(right.meta?.fecha || '')),
  );
  const trainRows = rows.filter((row) => !valKeys.has(row));

  return {
    trainRows,
    validationRows,
    strategy: 'estratificado aleatorio (mantiene proporcion de alertas)',
  };
}

async function trainModel(config = resolveTrainConfig()) {
  const { rows, inputColumns, outputColumn } = loadPredictiveDataset(config.datasetPath);
  const positiveCount = rows.filter((row) => row.output[outputColumn] === 1).length;

  const { trainRows, validationRows, strategy: splitStrategy } = splitTrainValidation(
    rows,
    config.validationRatio,
    outputColumn,
  );
  const scaler = buildScaler(trainRows);
  const trainData = rowsToBrainData(trainRows, scaler);
  const validationData = rowsToBrainData(validationRows, scaler);

  const hiddenLayers = config.hiddenLayers.length ? config.hiddenLayers : [8, 4];
  const net = new brain.NeuralNetwork({
    hiddenLayers,
    activation: 'sigmoid',
  });

  console.log(`[ML] Dataset: ${config.datasetPath}`);
  console.log(`[ML] Filas: ${rows.length} | Positivos: ${positiveCount} (${((positiveCount / rows.length) * 100).toFixed(1)}%)`);
  console.log(`[ML] Train: ${trainRows.length} | Validacion: ${validationRows.length}`);
  console.log(`[ML] Entradas: ${inputColumns.join(', ')} -> ${outputColumn}`);
  console.log(`[ML] Capas ocultas: [${hiddenLayers.join(', ')}]`);

  const trainingResult = net.train(trainData, config.training);

  const optimal = findOptimalThreshold(net, validationData);
  const decisionThreshold = optimal.threshold;
  const trainMetrics = evaluateBinaryClassifier(net, trainData, decisionThreshold);
  const validationMetrics = optimal.metrics;

  const artifact = {
    savedAt: new Date().toISOString(),
    brainVersion: '1.6.1',
    datasetPath: config.datasetPath,
    inputColumns,
    outputColumn,
    scaler,
    hiddenLayers,
    threshold: decisionThreshold,
    thresholdTuning: {
      strategy: 'maxima balanced accuracy en validacion (20% final cronologico)',
      defaultThreshold: config.threshold,
      optimalThreshold: decisionThreshold,
    },
    training: {
      ...config.training,
      iterationsCompleted: trainingResult.iterations,
      finalError: trainingResult.error,
    },
    split: {
      trainSize: trainRows.length,
      validationSize: validationRows.length,
      validationRatio: config.validationRatio,
      strategy: splitStrategy,
    },
    metrics: {
      train: trainMetrics,
      validation: validationMetrics,
    },
    model: net.toJSON(),
  };

  await fs.mkdir(path.dirname(config.modelPath), { recursive: true });
  await fs.writeFile(config.modelPath, JSON.stringify(artifact, null, 2), 'utf8');
  await fs.writeFile(config.metricsPath, JSON.stringify(artifact.metrics, null, 2), 'utf8');
  clearModelCache();

  console.log(`[ML] Umbral optimo (validacion): ${decisionThreshold.toFixed(2)}`);
  console.log(`[ML] Error final: ${trainingResult.error.toFixed(6)} (${trainingResult.iterations} iteraciones)`);
  console.log(
    `[ML] Train  -> accuracy: ${(trainMetrics.accuracy * 100).toFixed(1)}% | precision: ${(trainMetrics.precision * 100).toFixed(1)}% | recall: ${(trainMetrics.recall * 100).toFixed(1)}% | f1: ${(trainMetrics.f1 * 100).toFixed(1)}%`,
  );
  console.log(
    `[ML] Valid. -> accuracy: ${(validationMetrics.accuracy * 100).toFixed(1)}% | precision: ${(validationMetrics.precision * 100).toFixed(1)}% | recall: ${(validationMetrics.recall * 100).toFixed(1)}% | f1: ${(validationMetrics.f1 * 100).toFixed(1)}%`,
  );
  console.log(`[ML] Modelo guardado: ${config.modelPath}`);
  console.log(`[ML] Metricas: ${config.metricsPath}`);

  return artifact;
}

if (require.main === module) {
  trainModel()
    .catch((error) => {
      console.error('[ML] Fallo el entrenamiento:', error);
      process.exitCode = 1;
    });
}

module.exports = {
  resolveTrainConfig,
  trainModel,
};

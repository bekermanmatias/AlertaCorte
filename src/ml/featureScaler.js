const { INPUT_COLUMNS } = require('./loadPredictiveDataset');

function buildScaler(rows) {
  const stats = {};

  for (const column of INPUT_COLUMNS) {
    const values = rows.map((row) => row.input[column]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    stats[column] = {
      min,
      max,
      range: range || 1,
    };
  }

  return stats;
}

function scaleInput(input, stats) {
  const scaled = {};

  for (const column of INPUT_COLUMNS) {
    const { min, range } = stats[column];
    scaled[column] = (input[column] - min) / range;
  }

  return scaled;
}

function unscaleInput(scaledInput, stats) {
  const original = {};

  for (const column of INPUT_COLUMNS) {
    const { min, range } = stats[column];
    original[column] = scaledInput[column] * range + min;
  }

  return original;
}

function rowsToBrainData(rows, stats) {
  return rows.map((row) => ({
    input: scaleInput(row.input, stats),
    output: row.output,
  }));
}

module.exports = {
  buildScaler,
  rowsToBrainData,
  scaleInput,
  unscaleInput,
};

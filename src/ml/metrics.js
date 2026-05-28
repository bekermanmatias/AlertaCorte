function evaluateBinaryClassifier(net, samples, threshold = 0.5) {
  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;

  for (const sample of samples) {
    const raw = net.run(sample.input);
    const predicted = (raw.Alerta_Corte ?? raw.alerta_corte ?? Object.values(raw)[0]) >= threshold ? 1 : 0;
    const actual = sample.output.Alerta_Corte;

    if (predicted === 1 && actual === 1) {
      tp += 1;
    } else if (predicted === 0 && actual === 0) {
      tn += 1;
    } else if (predicted === 1 && actual === 0) {
      fp += 1;
    } else {
      fn += 1;
    }
  }

  const total = tp + tn + fp + fn;
  const accuracy = total ? (tp + tn) / total : 0;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    tp,
    tn,
    fp,
    fn,
    accuracy,
    precision,
    recall,
    f1,
    threshold,
  };
}

function balancedAccuracy(metrics) {
  const sensitivity = metrics.recall;
  const specificity = metrics.tn + metrics.fp > 0 ? metrics.tn / (metrics.tn + metrics.fp) : 0;
  return (sensitivity + specificity) / 2;
}

function findOptimalThreshold(net, samples) {
  let bestThreshold = 0.5;
  let bestMetrics = evaluateBinaryClassifier(net, samples, 0.5);
  let bestScore = balancedAccuracy(bestMetrics);

  for (let step = 40; step <= 75; step += 1) {
    const threshold = step / 100;
    const metrics = evaluateBinaryClassifier(net, samples, threshold);
    const score = balancedAccuracy(metrics);

    if (score > bestScore) {
      bestScore = score;
      bestThreshold = threshold;
      bestMetrics = metrics;
    }
  }

  return {
    threshold: bestThreshold,
    metrics: bestMetrics,
    balancedAccuracy: bestScore,
  };
}

module.exports = {
  evaluateBinaryClassifier,
  findOptimalThreshold,
};

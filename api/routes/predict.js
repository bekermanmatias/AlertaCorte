const express = require('express');

const { getPredictorStatus, predict } = require('../../src/ml/predictor');

const router = express.Router();

router.get('/model', async (req, res, next) => {
  try {
    const status = await getPredictorStatus();
    if (!status.ready) {
      res.status(503).json(status);
      return;
    }

    res.json(status);
  } catch (error) {
    next(error);
  }
});

router.post('/predict', async (req, res, next) => {
  try {
    const result = await predict(req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

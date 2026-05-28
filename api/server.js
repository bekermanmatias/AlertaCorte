require('dotenv').config();

const path = require('path');
const express = require('express');

const { resolveApiConfig } = require('./config');
const predictRouter = require('./routes/predict');
const { getPredictorStatus } = require('../src/ml/predictor');

const config = resolveApiConfig();
const app = express();

app.use(express.json());
app.use(express.static(config.webRoot));

app.get('/api/health', async (req, res) => {
  const model = await getPredictorStatus();
  res.json({
    status: 'ok',
    service: 'alertacorte-api',
    modelReady: model.ready,
  });
});

app.use('/api', predictRouter);

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(config.webRoot, 'index.html'));
});

app.use((error, req, res, next) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    error: error.message || 'Error interno del servidor',
  });
});

app.listen(config.port, config.host, async () => {
  const model = await getPredictorStatus();
  console.log(`[API] AlertaCorte en http://${config.host}:${config.port}`);
  console.log(`[API] Interfaz web: http://${config.host}:${config.port}/`);
  console.log(`[API] Modelo listo: ${model.ready ? 'si' : 'no'} (${model.modelPath || 'sin ruta'})`);
});

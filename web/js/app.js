const form = document.getElementById('predict-form');
const submitBtn = document.getElementById('submit-btn');
const demoBtn = document.getElementById('demo-btn');
const modelStatus = document.getElementById('model-status');
const resultCard = document.getElementById('result-card');
const resultAlert = document.getElementById('result-alert');
const resultProbability = document.getElementById('result-probability');
const resultThreshold = document.getElementById('result-threshold');
const resultLabel = document.getElementById('result-label');
const resultWarnings = document.getElementById('result-warnings');
const errorBanner = document.getElementById('error-banner');

function showError(message) {
  errorBanner.hidden = false;
  errorBanner.textContent = message;
}

function clearError() {
  errorBanner.hidden = true;
  errorBanner.textContent = '';
}

function readFormPayload() {
  return {
    tipo_dia: Number(form.tipo_dia.value),
    temperatura_media_gba: Number(form.temperatura.value),
    demanda_dia_anterior: Number(form.demanda.value),
    mes_estacional: Number(form.mes.value),
  };
}

function renderResult(data) {
  resultCard.hidden = false;
  const isAlert = data.alerta_corte_suministro === 1;

  resultAlert.textContent = data.etiqueta;
  resultAlert.className = `result-alert ${isAlert ? 'danger' : 'ok'}`;
  resultProbability.textContent =
    data.probabilidad_texto || `${(data.probabilidad * 100).toFixed(1)} %`;
  resultThreshold.textContent = `${(data.umbral * 100).toFixed(0)} %`;
  resultLabel.textContent = String(data.alerta_corte_suministro);

  const warnings = data.advertencias || [];
  if (warnings.length) {
    resultWarnings.hidden = false;
    resultWarnings.innerHTML = warnings.map((text) => `<li>${text}</li>`).join('');
  } else {
    resultWarnings.hidden = true;
    resultWarnings.innerHTML = '';
  }
}

async function checkModel() {
  try {
    const response = await fetch('/api/model');
    const data = await response.json();

    if (!response.ok || !data.ready) {
      modelStatus.textContent = 'Modelo no disponible';
      modelStatus.className = 'status-pill error';
      showError(data.error || 'Entrená el modelo con npm run ml:train');
      submitBtn.disabled = true;
      return;
    }

    modelStatus.textContent = 'Modelo cargado';
    modelStatus.className = 'status-pill ready';
    submitBtn.disabled = false;
  } catch {
    modelStatus.textContent = 'API sin conexión';
    modelStatus.className = 'status-pill error';
    showError('No se pudo conectar con la API. Ejecutá npm run api:start');
    submitBtn.disabled = true;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Calculando…';

  try {
    const response = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readFormPayload()),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al predecir');
    }

    renderResult(data);
  } catch (error) {
    showError(error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Predecir alerta';
  }
});

demoBtn.addEventListener('click', () => {
  form.tipo_dia.value = '1';
  form.temperatura.value = '32';
  form.demanda.value = '8200';
  form.mes.value = '1';
  clearError();
});

checkModel();

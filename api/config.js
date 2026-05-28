const path = require('path');

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveApiConfig() {
  return {
    host: process.env.API_HOST || '127.0.0.1',
    port: parsePositiveInt(process.env.API_PORT, 3000),
    webRoot: path.resolve(process.cwd(), process.env.API_WEB_ROOT || 'web'),
  };
}

module.exports = {
  resolveApiConfig,
};

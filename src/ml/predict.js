require('dotenv').config();

const { predict } = require('./predictor');

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Uso: npm run ml:predict -- [tipo_dia] [temperatura] [demanda] [mes]');
    return;
  }

  const sample =
    args.length >= 4
      ? {
          tipo_dia: args[0],
          temperatura_media_gba: args[1],
          demanda_dia_anterior: args[2],
          mes_estacional: args[3],
        }
      : {
          tipo_dia: 1,
          temperatura_media_gba: 34,
          demanda_dia_anterior: 8500,
          mes_estacional: 1,
        };

  const result = await predict(sample);
  console.log('[ML] Prediccion:', result);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[ML] Error en prediccion:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { predict };

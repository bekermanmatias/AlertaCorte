const BASE_INPUT_COLUMNS = [
  'Tipo_Dia',
  'Temperatura_Media_GBA',
  'Demanda_Dia_Anterior',
  'Mes_Estacional',
];

const DERIVED_INPUT_COLUMNS = [
  'Mes_Ciclico_Sin',
  'Mes_Ciclico_Cos',
  'Indice_Calor_Demanda',
];

const INPUT_COLUMNS = [...BASE_INPUT_COLUMNS, ...DERIVED_INPUT_COLUMNS];

function addDerivedFeatures(input) {
  const month = Number(input.Mes_Estacional);
  const temperature = Number(input.Temperatura_Media_GBA);
  const demand = Number(input.Demanda_Dia_Anterior);
  const monthAngle = ((month - 1) / 12) * 2 * Math.PI;

  return {
    ...input,
    Mes_Ciclico_Sin: Math.sin(monthAngle),
    Mes_Ciclico_Cos: Math.cos(monthAngle),
    Indice_Calor_Demanda: Math.max(0, temperature - 24) * (demand / 1000),
  };
}

module.exports = {
  addDerivedFeatures,
  BASE_INPUT_COLUMNS,
  DERIVED_INPUT_COLUMNS,
  INPUT_COLUMNS,
};

export function shortModel(model: string) {
  return model.replace(/[:-]?cloud$/, "").replace(":latest", "");
}

// Los modelos "-cloud"/"cloud:" de Ollama corren en los servidores de Ollama
// (tu Ollama local solo los proxea): a diferencia de un modelo local real,
// el contenido del chat sí sale de tu máquina.
export function isCloudModel(model: string) {
  return /[:-]cloud$/.test(model);
}

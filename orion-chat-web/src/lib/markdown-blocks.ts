// Corta un texto Markdown en bloques de nivel superior.
//
// Existe por una razón de performance concreta: durante el streaming el
// contenido del mensaje cambia en cada token, y si se le pasa el string
// entero a react-markdown, vuelve a parsear TODO el mensaje en cada token.
// Eso es O(n²) sobre la respuesta completa y se nota como tirones a partir
// de unos pocos párrafos.
//
// Partiendo en bloques y memoizando cada uno, solo se re-parsea el último
// bloque —el que está creciendo—; los anteriores ya no cambian nunca.
//
// El corte es por línea en blanco, PERO respetando los bloques de código:
// adentro de un ``` las líneas en blanco son parte del código y partir ahí
// rompería el bloque en pedazos que ya no parsean como código.

export function splitMarkdownBlocks(markdown: string): string[] {
  const lines = markdown.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let fence: string | null = null;

  const flush = () => {
    if (current.length > 0) {
      blocks.push(current.join("\n"));
      current = [];
    }
  };

  for (const line of lines) {
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);

    if (fence === null && fenceMatch) {
      // Abre un bloque de código: lo que venía antes es un bloque aparte.
      flush();
      fence = fenceMatch[1][0];
      current.push(line);
      continue;
    }

    if (fence !== null) {
      current.push(line);
      // Cierra solo con el mismo carácter de valla con el que abrió: un ~~~
      // adentro de un ``` es contenido, no un cierre.
      if (fenceMatch && fenceMatch[1][0] === fence) {
        fence = null;
        flush();
      }
      continue;
    }

    if (line.trim() === "") {
      flush();
      continue;
    }

    current.push(line);
  }

  flush();
  return blocks;
}

// Durante el streaming es normal que el último bloque sea un ``` todavía sin
// cerrar. Sin esto, react-markdown lo renderiza como párrafo suelto con los
// backticks a la vista, y en cuanto llega el cierre salta de golpe a bloque
// de código: la respuesta "parpadea" mientras se escribe.
export function closeOpenFence(block: string): string {
  const lines = block.split("\n");
  let fence: string | null = null;

  for (const line of lines) {
    const match = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (!match) continue;
    if (fence === null) fence = match[1][0];
    else if (match[1][0] === fence) fence = null;
  }

  if (fence === null) return block;
  // Si la valla abrió justo al final y todavía no hay ni un salto de línea,
  // hace falta uno para que el cierre no quede pegado al lenguaje.
  return block.endsWith("\n") ? `${block}${fence.repeat(3)}` : `${block}\n${fence.repeat(3)}`;
}

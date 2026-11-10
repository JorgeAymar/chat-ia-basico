import type { Source } from "@/lib/stream";

// COPIA DELIBERADA de `linkCitations` de src/components/Markdown.tsx.
//
// El original vive dentro de un componente cliente ("use client") y no está
// exportado: exportarlo solo para poder testearlo ensuciaría la API pública
// del componente (que expone Markdown y CopyButton, nada más) y arrastraría
// react-markdown, katex y highlight.js a este test, que es de texto puro.
// Si se toca la versión de Markdown.tsx, hay que replicar el cambio acá.
function linkCitations(markdown: string, sources: Source[]): string {
  if (sources.length === 0) return markdown;
  return markdown.replace(/\[(\d{1,2})\](?!\()/g, (match, number: string) => {
    const source = sources[Number(number) - 1];
    if (!source) return match;
    const title = source.title.replace(/"/g, "'");
    return `[${match}](${source.url} "${title}")`;
  });
}

const sources: Source[] = [
  { title: "Wikipedia", url: "https://es.wikipedia.org/x", snippet: "" },
  { title: "MDN", url: "https://developer.mozilla.org/y", snippet: "" },
];

describe("linkCitations", () => {
  it("convierte el marcador [1] en un enlace a la fuente correspondiente", () => {
    expect(linkCitations("La capital es París [1].", sources)).toBe(
      'La capital es París [[1]](https://es.wikipedia.org/x "Wikipedia").'
    );
  });

  it("mapea cada número a su fuente por posición", () => {
    const out = linkCitations("uno [1] y dos [2]", sources);
    expect(out).toContain('[[1]](https://es.wikipedia.org/x "Wikipedia")');
    expect(out).toContain('[[2]](https://developer.mozilla.org/y "MDN")');
  });

  it("deja intacto un número sin fuente correspondiente", () => {
    // El modelo alucina citas fuera de rango todo el tiempo; un [7] con dos
    // fuentes tiene que quedar como texto plano y no como enlace roto.
    expect(linkCitations("dato inventado [7]", sources)).toBe("dato inventado [7]");
    // [0] tampoco existe: la numeración que ve el modelo arranca en 1.
    expect(linkCitations("dato [0]", sources)).toBe("dato [0]");
  });

  it("no toca un enlace Markdown que ya tiene la forma [1](url)", () => {
    // El lookahead que niega "(" existe para esto: reemplazarlo generaría
    // "[[1]](fuente)(url)" y rompería el enlace original.
    const entrada = "ver [1](https://otro.com) para más";
    expect(linkCitations(entrada, sources)).toBe(entrada);
  });

  it("escapa las comillas dobles del título, que romperían el atributo", () => {
    const conComillas: Source[] = [
      { title: 'El libro "Rayuela" en línea', url: "https://libro.com", snippet: "" },
    ];
    const out = linkCitations("segun la fuente [1]", conComillas);
    expect(out).toBe('segun la fuente [[1]](https://libro.com "El libro \'Rayuela\' en línea")');
    // Solo debe quedar el par de comillas del atributo title.
    expect(out.split('"')).toHaveLength(3);
  });

  it("devuelve el texto sin cambios si no hay fuentes", () => {
    expect(linkCitations("algo con [1] adentro", [])).toBe("algo con [1] adentro");
  });

  it("reemplaza todas las apariciones del mismo marcador", () => {
    const out = linkCitations("[1] al principio y otra vez [1] al final", sources);
    expect(out.match(/https:\/\/es\.wikipedia\.org\/x/g)).toHaveLength(2);
  });

  it("ignora números de más de dos dígitos", () => {
    // La regex acota a \d{1,2}: años y cifras del texto normal no son citas.
    expect(linkCitations("el año [1994] fue clave", sources)).toBe("el año [1994] fue clave");
  });
});

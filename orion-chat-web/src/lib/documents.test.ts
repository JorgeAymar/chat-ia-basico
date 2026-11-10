// unpdf y mammoth se mockean solo para no cargarlos: son dependencias pesadas
// (pdf.js completo) y estos tests apuntan a las funciones puras del módulo,
// no al parseo real de archivos.
jest.mock("unpdf", () => ({ extractText: jest.fn() }));
jest.mock("mammoth", () => ({ __esModule: true, default: { extractRawText: jest.fn() } }));

import { cutAtBoundary, assembleBlocks, isSupportedDocument } from "./documents";

describe("cutAtBoundary", () => {
  it("devuelve el bloque intacto si entra entero en el límite", () => {
    expect(cutAtBoundary("hola mundo", 50)).toBe("hola mundo");
    expect(cutAtBoundary("hola mundo", 10)).toBe("hola mundo");
  });

  it("corta en el último salto de párrafo disponible", () => {
    const bloque = "primer párrafo\n\nsegundo párrafo bastante largo";
    expect(cutAtBoundary(bloque, 20)).toBe("primer párrafo");
  });

  it("corta en el último salto de línea cuando no hay párrafos", () => {
    const bloque = "linea uno mas larga\nsegunda linea que sobra";
    expect(cutAtBoundary(bloque, 25)).toBe("linea uno mas larga");
  });

  it("corta en el último espacio cuando no hay saltos", () => {
    expect(cutAtBoundary("palabra uno dos tres cuatro", 20)).toBe("palabra uno dos");
  });

  it("nunca parte una palabra al medio si hay un límite natural razonable", () => {
    const resultado = cutAtBoundary("aaa bbb ccc ddd eee fff", 10);
    expect(resultado).toBe("aaa bbb");
    // El texto original tiene que seguir empezando con lo que devolvimos y el
    // carácter siguiente ser un separador: eso prueba que no cortó adentro
    // de una palabra.
    expect("aaa bbb ccc ddd eee fff".startsWith(`${resultado} `)).toBe(true);
  });

  it("prefiere el corte duro cuando el único límite natural deja menos de la mitad del texto", () => {
    // "ab " es el único espacio y cae en el índice 2 de un límite de 20:
    // respetarlo devolvería 2 caracteres de 20 posibles. La regla del código
    // (index > limit * 0.5) elige perder una palabra antes que el bloque.
    const bloque = `ab ${"x".repeat(40)}`;
    const resultado = cutAtBoundary(bloque, 20);
    expect(resultado).toHaveLength(20);
    expect(resultado.startsWith("ab x")).toBe(true);
  });

  it("saca los espacios sobrantes del final del corte", () => {
    // El corte cae adentro de una corrida de espacios; el resultado no debe
    // arrastrarlos.
    const resultado = cutAtBoundary("palabra uno dos    tres cuatro", 20);
    expect(resultado).toBe("palabra uno dos");
  });
});

describe("assembleBlocks", () => {
  const sinEtiqueta = () => "";

  it("incluye todos los bloques cuando entran y no marca truncado", () => {
    const out = assembleBlocks(["uno", "dos"], sinEtiqueta, 1000);
    expect(out.text).toBe("uno\n\ndos");
    expect(out.included).toBe(2);
    expect(out.truncated).toBe(false);
  });

  it("aplica la etiqueta de página a cada bloque", () => {
    const out = assembleBlocks(["uno", "dos"], (i) => `[página ${i + 1}]`, 1000);
    expect(out.text).toContain("[página 1]\nuno");
    expect(out.text).toContain("[página 2]\ndos");
  });

  it("marca truncado y agrega la leyenda cuando no entran todos los bloques", () => {
    const out = assembleBlocks(["a".repeat(50), "b".repeat(50)], sinEtiqueta, 60);
    expect(out.included).toBe(1);
    expect(out.truncated).toBe(true);
    expect(out.text).toContain("se incluyeron 1 de 2 páginas/secciones");
    expect(out.text).not.toContain("bbbb");
  });

  it("incluye un pedazo del bloque que no entra si queda texto útil", () => {
    const relleno = "palabra ".repeat(20).trim();
    const out = assembleBlocks([relleno, "otro bloque"], sinEtiqueta, 60);
    expect(out.truncated).toBe(true);
    expect(out.text.startsWith("palabra palabra")).toBe(true);
    expect(out.included).toBe(0);
  });

  it("las páginas en blanco cuentan como incluidas pero no ocupan lugar", () => {
    const out = assembleBlocks(["", "texto", ""], sinEtiqueta, 1000);
    expect(out.included).toBe(3);
    expect(out.truncated).toBe(false);
    expect(out.text).toBe("texto");
  });

  it("un documento entero en blanco no se considera truncado", () => {
    const out = assembleBlocks(["", ""], sinEtiqueta, 100);
    expect(out.text).toBe("");
    expect(out.included).toBe(2);
    expect(out.truncated).toBe(false);
  });

  it("una lista vacía devuelve texto vacío sin truncar", () => {
    expect(assembleBlocks([], sinEtiqueta, 100)).toEqual({
      text: "",
      included: 0,
      truncated: false,
    });
  });
});

describe("isSupportedDocument", () => {
  it("acepta PDF por mimetype y por extensión", () => {
    expect(isSupportedDocument("informe.bin", "application/pdf")).toBe(true);
    expect(isSupportedDocument("informe.pdf", "application/octet-stream")).toBe(true);
  });

  it("acepta DOCX por mimetype y por extensión", () => {
    expect(
      isSupportedDocument(
        "carta.bin",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe(true);
    expect(isSupportedDocument("carta.docx", "")).toBe(true);
  });

  it("no distingue mayúsculas en la extensión", () => {
    // Windows y muchos escáneres mandan la extensión en mayúsculas.
    expect(isSupportedDocument("INFORME.PDF", "")).toBe(true);
    expect(isSupportedDocument("Carta.DocX", "")).toBe(true);
  });

  it("rechaza otros formatos", () => {
    expect(isSupportedDocument("notas.txt", "text/plain")).toBe(false);
    expect(isSupportedDocument("viejo.doc", "application/msword")).toBe(false);
    expect(isSupportedDocument("foto.png", "image/png")).toBe(false);
  });

  it("no se rompe con un nombre sin extensión", () => {
    expect(isSupportedDocument("archivo", "text/plain")).toBe(false);
    expect(isSupportedDocument("", "")).toBe(false);
  });

  it("usa la última extensión de un nombre con varios puntos", () => {
    expect(isSupportedDocument("backup.pdf.txt", "text/plain")).toBe(false);
    expect(isSupportedDocument("mi.informe.final.pdf", "")).toBe(true);
  });
});

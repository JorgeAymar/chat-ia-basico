// Genera los archivos de fixtures usados por los tests E2E de Playwright.
// Correr con: node e2e/fixtures/generate-fixtures.mjs
//
// No se "descargan" archivos externos: el .txt se escribe directo y el PNG
// se arma a mano (bytes mínimos válidos de un PNG 1x1 rojo) sin dependencias.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- test-doc.txt: contiene un dato verificable único ---
const secretDoc = `Este es un documento de prueba para los tests E2E de Ámbar.
El código secreto de esta prueba es AMBAR-7X92.
No compartas este código fuera del contexto de este test.
`;
writeFileSync(path.join(__dirname, "test-doc.txt"), secretDoc, "utf-8");

// --- test-image.png: PNG 1x1 válido (rojo sólido), generado a mano ---
// PNG mínimo: firma + IHDR + IDAT + IEND, con CRCs correctos.
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// zlib no comprimido mínimo requiere deflate real; usamos zlib de node.
import zlib from "node:zlib";

const width = 2;
const height = 2;
// Cada fila: filter byte (0) + RGB * width
const raw = Buffer.alloc(height * (1 + width * 3));
let offset = 0;
for (let y = 0; y < height; y++) {
  raw[offset++] = 0; // filter: none
  for (let x = 0; x < width; x++) {
    raw[offset++] = 220; // R
    raw[offset++] = 38; // G
    raw[offset++] = 38; // B (rojo tipo "AMBAR" accent, da igual)
  }
}
const idatData = zlib.deflateSync(raw);

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ihdrData = Buffer.alloc(13);
ihdrData.writeUInt32BE(width, 0);
ihdrData.writeUInt32BE(height, 4);
ihdrData[8] = 8; // bit depth
ihdrData[9] = 2; // color type: RGB
ihdrData[10] = 0; // compression
ihdrData[11] = 0; // filter
ihdrData[12] = 0; // interlace

const png = Buffer.concat([
  signature,
  chunk("IHDR", ihdrData),
  chunk("IDAT", idatData),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync(path.join(__dirname, "test-image.png"), png);

console.log("Fixtures generadas: test-doc.txt, test-image.png");

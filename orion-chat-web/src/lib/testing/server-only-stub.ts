// Stub para tests. El paquete real `server-only` explota con cualquier
// `require`/`import` fuera del bundler de Next (no distingue entorno server
// vs. cliente por sí mismo — es Next quien lo reemplaza por un no-op al
// compilar para el servidor). Jest corre fuera de ese bundler, así que
// jest.config.js mapea `server-only` acá para todos los tests.
export {};

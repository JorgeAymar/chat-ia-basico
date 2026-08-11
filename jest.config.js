/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // El paquete real revienta fuera del bundler de Next. Ver el stub.
    "^server-only$": "<rootDir>/src/lib/testing/server-only-stub.ts",
  },
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "<rootDir>/e2e/"],
  // `jose` se publica solo como ESM (sin build CJS), y Jest por default no
  // transforma nada dentro de node_modules. Sin esto, cualquier test que
  // toque (aunque sea de forma transitiva) src/lib/auth/session.ts explota
  // con "Unexpected token 'export'" al intentar cargarlo con `require`.
  transformIgnorePatterns: ["/node_modules/(?!(jose)/)"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
    "^.+\\.jsx?$": "ts-jest",
  },
};

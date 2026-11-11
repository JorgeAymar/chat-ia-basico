"use client";

// Último recurso: falla el layout raíz mismo, así que no hay CSS ni tokens
// disponibles — colores inline para que nunca quede una pantalla en blanco.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#0a0a0f",
          color: "#f4f4f8",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0 }}>Algo salió mal</h1>
        <p style={{ margin: 0, color: "#9696ab", fontSize: 14 }}>Ocurrió un error inesperado.</p>
        <button
          type="button"
          onClick={reset}
          style={{ background: "#7c3aed", color: "#fff", border: 0, borderRadius: 12, padding: "10px 20px", fontSize: 14, fontWeight: 600 }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}

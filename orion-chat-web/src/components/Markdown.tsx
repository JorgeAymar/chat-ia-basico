"use client";

import { memo, useMemo, useState, type ReactNode, type ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { splitMarkdownBlocks, closeOpenFence } from "@/lib/markdown-blocks";
import type { Source } from "@/lib/stream";

// Baja el nivel de los encabezados: un "# Título" adentro de una burbuja de
// chat no debería verse más grande que el título de la app.
const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [
  rehypeKatex,
  // `detect: false` evita que highlight.js adivine el lenguaje en bloques sin
  // etiquetar: adivina mal seguido y colorea prosa como si fuera código.
  [rehypeHighlight, { detect: false, ignoreMissing: true }] as const,
];

function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (element?.props) return extractText(element.props.children);
  return "";
}

function CopyButton({
  text,
  label = "Copiar",
  display = "Copiar",
  tone = "default",
}: {
  text: string;
  // "code": sobre la barra del bloque de código, que es oscura en los dos
  // temas — ahí los colores salen de --code-ink, no de --ink.
  tone?: "default" | "code";
  // Lo que lee un lector de pantalla (más específico: "Copiar código").
  label?: string;
  // Lo que se ve: corto, como en el diseño de Stitch.
  display?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Sin permiso de portapapeles (o contexto no seguro): no hay nada
      // razonable que hacer más que no romper nada.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copiado" : label}
      title={label}
      className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none ${
        tone === "code"
          ? "border border-[var(--code-ink)]/15 bg-[var(--code-ink)]/5 text-[var(--code-ink)]/75 hover:bg-[var(--code-ink)]/10 hover:text-[var(--code-ink)]"
          : "text-[var(--ink-dim)] hover:bg-[var(--panel-2)] hover:text-[var(--ink)]"
      }`}
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0 text-[var(--accent-bright)]" aria-hidden="true">
          <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
          <rect x="5" y="5" width="8.5" height="8.5" rx="1.8" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3 10.5V3.8A1.3 1.3 0 014.3 2.5H11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )}
      <span>{copied ? "Copiado" : display}</span>
    </button>
  );
}

// Extensión de archivo por lenguaje detectado, para el nombre que sugiere
// el botón "Descargar". Solo cubre los lenguajes que un modelo de chat
// genera seguido; cualquier otro cae en .txt, que siempre es válido.
const EXTENSION_BY_LANGUAGE: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  jsx: "jsx",
  tsx: "tsx",
  python: "py",
  ruby: "rb",
  go: "go",
  java: "java",
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  rust: "rs",
  php: "php",
  bash: "sh",
  shell: "sh",
  sql: "sql",
  json: "json",
  yaml: "yml",
  html: "html",
  css: "css",
  markdown: "md",
};

function downloadText(text: string, filename: string, mimeType: string) {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Sin esto el blob queda retenido en memoria hasta recargar la página.
  URL.revokeObjectURL(url);
}

function DownloadButton({ text, filename }: { text: string; filename: string }) {
  return (
    <button
      type="button"
      onClick={() => downloadText(text, filename, "text/plain")}
      aria-label={`Descargar ${filename}`}
      title={`Descargar como ${filename}`}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-[var(--code-ink)]/75 transition-colors hover:bg-[var(--code-ink)]/10 hover:text-[var(--code-ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:outline-none"
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
        <path
          d="M8 2v8m0 0L5 7m3 3l3-3M3 12v1.5A1.5 1.5 0 004.5 15h7a1.5 1.5 0 001.5-1.5V12"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Descargar
    </button>
  );
}

// Contador global para que dos bloques de código sin lenguaje en la misma
// respuesta no se pisen el nombre de archivo (los dos serían "codigo.txt").
let anonymousBlockCounter = 0;

function CodeBlock({ children }: { children: ReactNode }) {
  const child = (Array.isArray(children) ? children[0] : children) as
    | ReactElement<{ className?: string; children?: ReactNode }>
    | undefined;
  const className = child?.props?.className ?? "";
  const language = /language-([\w-]+)/.exec(className)?.[1] ?? "";
  const code = extractText(child?.props?.children);
  const extension = EXTENSION_BY_LANGUAGE[language] ?? "txt";
  const filename = useMemo(
    () => `codigo-${language || ++anonymousBlockCounter}.${extension}`,
    [language, extension]
  );

  return (
    // Cromo tipo editor del diseño de Stitch: barra superior con los tres
    // puntos de ventana, el lenguaje en mayúsculas y las acciones a la
    // derecha; el cuerpo en el fondo más oscuro de la paleta, monoespaciado.
    <div className="group/code my-4 overflow-hidden rounded-xl border border-[var(--code-ink)]/10 bg-[var(--code-bg)] shadow-md">
      <div className="flex items-center justify-between border-b border-[var(--code-ink)]/10 bg-[var(--code-bar)] px-4 py-1.5">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" aria-hidden="true" />
          <span className="ml-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--code-ink)]/75">
            {language || "texto"}
          </span>
        </span>
        <span className="flex items-center gap-0.5">
          <DownloadButton text={code} filename={filename} />
          <CopyButton text={code} label="Copiar código" display="Copiar código" tone="code" />
        </span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-[1.6] text-[var(--code-ink)]">{children}</pre>
    </div>
  );
}

// Convierte los marcadores [1] [2] que escribe el modelo en enlaces a las
// fuentes de la búsqueda web. Se hace sobre el texto Markdown, antes de
// parsear, porque es la forma más barata: no hace falta un plugin de remark
// ni recorrer el árbol.
//
// El lookahead niega "(": "[1](http://…)" ya es un enlace Markdown y
// reemplazarlo lo rompería.
function linkCitations(markdown: string, sources: Source[]): string {
  if (sources.length === 0) return markdown;
  return markdown.replace(/\[(\d{1,2})\](?!\()/g, (match, number: string) => {
    const source = sources[Number(number) - 1];
    if (!source) return match;
    const title = source.title.replace(/"/g, "'");
    return `[${match}](${source.url} "${title}")`;
  });
}

const markdownComponents = {
  pre: CodeBlock,
  code({ className, children, ...props }: { className?: string; children?: ReactNode }) {
    // El código en bloque ya lo envuelve CodeBlock; acá solo se estiliza el
    // código inline, que no lleva clase de lenguaje.
    if (className?.includes("language-")) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-md border border-[var(--accent-bright)]/25 bg-[var(--accent-dim)] px-1.5 py-0.5 font-mono text-[0.88em] font-medium text-[var(--accent-bright)]"
        {...props}
      >
        {children}
      </code>
    );
  },
  a({ href, children, ...props }: { href?: string; children?: ReactNode }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--accent-bright)] underline decoration-[var(--accent-bright)]/30 underline-offset-2 transition-colors hover:decoration-[var(--accent-bright)]"
        {...props}
      >
        {children}
      </a>
    );
  },
  table({ children }: { children?: ReactNode }) {
    // Las tablas anchas scrollean adentro de su propio contenedor: si no,
    // desbordan la burbuja y estiran el layout entero.
    return (
      <div className="my-4 overflow-x-auto rounded-xl border border-[var(--line)]">
        <table className="w-full border-collapse text-[13px]">{children}</table>
      </div>
    );
  },
  th({ children }: { children?: ReactNode }) {
    return (
      <th className="border-b border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--ink-dim)]">
        {children}
      </th>
    );
  },
  td({ children }: { children?: ReactNode }) {
    return <td className="border-b border-[var(--line)] px-3 py-2 align-top">{children}</td>;
  },
};

// Un bloque de Markdown ya aislado. El memo es el punto de todo esto: durante
// el streaming solo cambia el último bloque, así que los anteriores no se
// vuelven a parsear en cada token.
const MarkdownBlock = memo(function MarkdownBlock({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rehypePlugins={rehypePlugins as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      components={markdownComponents as any}
    >
      {markdown}
    </ReactMarkdown>
  );
});

export function Markdown({
  content,
  sources = [],
}: {
  content: string;
  sources?: Source[];
}) {
  const blocks = useMemo(() => {
    const withCitations = linkCitations(content, sources);
    return splitMarkdownBlocks(withCitations).map(closeOpenFence);
  }, [content, sources]);

  return (
    <div className="markdown-body">
      {blocks.map((block, index) => (
        // La clave es el índice a propósito: los bloques anteriores al último
        // no cambian de posición durante el streaming, así que el índice es
        // estable y evita remontar todo cuando crece la respuesta.
        <MarkdownBlock key={index} markdown={block} />
      ))}
    </div>
  );
}

export { CopyButton };

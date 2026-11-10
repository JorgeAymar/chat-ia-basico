"use client";

// Exportar la conversación completa a un archivo. Vive separado de page.tsx
// para no cargarle más estado a un componente ya grande, y porque el PDF
// necesita jsPDF, que conviene mantener aislado en un solo lugar.
import { jsPDF } from "jspdf";
import type { Conversation, Message } from "./types";

export type ExportFormat = "md" | "txt" | "json" | "pdf";

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  md: "Markdown (.md)",
  txt: "Texto plano (.txt)",
  json: "JSON (.json)",
  pdf: "PDF (.pdf)",
};

function safeFilename(title: string): string {
  return title.replace(/[^\w\sáéíóúñÁÉÍÓÚÑ-]/gi, "").trim() || "conversacion";
}

function whoLabel(message: Message, model: string | undefined): string {
  return message.role === "user" ? "Vos" : model ?? "Asistente";
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Sin esto el blob queda retenido en memoria hasta recargar la página.
  URL.revokeObjectURL(url);
}

function toMarkdown(title: string, model: string | undefined, messages: Message[]): string {
  const body = messages
    .map((m) => {
      const sources =
        m.sources && m.sources.length > 0
          ? "\n\n### Fuentes\n" + m.sources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`).join("\n")
          : "";
      return `## ${whoLabel(m, model)}\n\n${m.content}${sources}`;
    })
    .join("\n\n---\n\n");
  return `# ${title}\n\n${body}\n`;
}

function toPlainText(title: string, model: string | undefined, messages: Message[]): string {
  const body = messages
    .map((m) => {
      const sources =
        m.sources && m.sources.length > 0
          ? "\n\nFuentes:\n" + m.sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}`).join("\n")
          : "";
      return `${whoLabel(m, model)}:\n${m.content}${sources}`;
    })
    .join("\n\n----------\n\n");
  return `${title}\n${"=".repeat(title.length)}\n\n${body}\n`;
}

function toJson(title: string, conversation: Conversation | undefined, messages: Message[]): string {
  return JSON.stringify(
    {
      title,
      model: conversation?.model ?? null,
      exportedAt: new Date().toISOString(),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        thinking: m.thinking ?? null,
        thinkingMs: m.thinkingMs ?? null,
        sources: m.sources ?? [],
        // Solo el nombre de los adjuntos, no el contenido/base64: infla el
        // archivo sin agregar nada legible en un backup de texto.
        attachments: (m.attachments ?? []).map((a) => a.name),
      })),
    },
    null,
    2
  );
}

function toPdf(title: string, model: string | undefined, messages: Message[]): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  function ensureSpace(lineHeight: number) {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function writeLines(text: string, fontSize: number, style: "normal" | "bold") {
    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);
    const lineHeight = fontSize * 1.35;
    for (const line of doc.splitTextToSize(text, maxWidth) as string[]) {
      ensureSpace(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
  }

  writeLines(title, 16, "bold");
  y += 8;

  for (const m of messages) {
    ensureSpace(20);
    y += 10;
    writeLines(whoLabel(m, model), 10, "bold");
    writeLines(m.content || "(sin contenido)", 10.5, "normal");

    if (m.sources && m.sources.length > 0) {
      y += 4;
      writeLines("Fuentes:", 9.5, "bold");
      m.sources.forEach((s, i) => writeLines(`${i + 1}. ${s.title} — ${s.url}`, 9.5, "normal"));
    }
  }

  return doc.output("blob");
}

export function exportConversation(
  format: ExportFormat,
  conversation: Conversation | undefined,
  messages: Message[]
) {
  const title = conversation?.title ?? "conversación";
  const filename = safeFilename(title);
  const model = conversation?.model;

  if (format === "md") {
    download(new Blob([toMarkdown(title, model, messages)], { type: "text/markdown;charset=utf-8" }), `${filename}.md`);
  } else if (format === "txt") {
    download(new Blob([toPlainText(title, model, messages)], { type: "text/plain;charset=utf-8" }), `${filename}.txt`);
  } else if (format === "json") {
    download(new Blob([toJson(title, conversation, messages)], { type: "application/json;charset=utf-8" }), `${filename}.json`);
  } else {
    download(toPdf(title, model, messages), `${filename}.pdf`);
  }
}

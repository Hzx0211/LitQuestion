import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

export type AttachmentKind = "image" | "document";

export interface PreparedAttachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  mime: string;
  size: number;
  text?: string;
  dataUrl?: string;
  truncated?: boolean;
}

export interface PrepareAttachmentResult {
  attachments: PreparedAttachment[];
  errors: string[];
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 32 * 1024 * 1024;
const MAX_DOCUMENT_CHARS = 90_000;

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "jsonl",
  "xml",
  "html",
  "htm",
  "log",
  "rtf",
  "yaml",
  "yml",
  "toml",
  "ini",
  "sql",
  "css",
  "scss",
  "sass",
  "less",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "java",
  "c",
  "cc",
  "cpp",
  "h",
  "hpp",
  "cs",
  "go",
  "rs",
  "swift",
  "kt",
  "php",
  "rb",
  "sh",
  "zsh",
  "fish",
]);

const TEXT_MIME_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/javascript",
  "application/x-javascript",
  "application/typescript",
  "application/x-yaml",
  "application/yaml",
  "application/toml",
  "text/markdown",
]);

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

function isTextLike(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  if (TEXT_MIME_TYPES.has(file.type)) return true;
  return TEXT_EXTENSIONS.has(extensionOf(file.name));
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || extensionOf(file.name) === "pdf";
}

function isProbablyText(text: string): boolean {
  if (!text) return true;
  let suspicious = 0;
  const sample = text.slice(0, 4096);
  for (const ch of sample) {
    const code = ch.charCodeAt(0);
    if (ch === "\n" || ch === "\r" || ch === "\t") continue;
    if (code === 0xfffd || (code < 32 && code !== 27)) suspicious += 1;
  }
  return suspicious / sample.length < 0.02;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("文件读取失败"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readPdfTextItem(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const maybe = item as { str?: unknown; hasEOL?: unknown };
  const text = typeof maybe.str === "string" ? maybe.str : "";
  return maybe.hasEOL ? `${text}\n` : text;
}

async function extractPdfText(file: File): Promise<{ text: string; truncated: boolean }> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjsLib.getDocument({
    data,
    disableFontFace: true,
    isEvalSupported: false,
  });

  const pdf = await task.promise;
  const pages: string[] = [];
  let totalChars = 0;
  let truncated = false;

  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      if (totalChars >= MAX_DOCUMENT_CHARS) {
        truncated = true;
        break;
      }

      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = normalizeExtractedText(
        content.items.map(readPdfTextItem).join(" ")
      );
      page.cleanup();

      if (!pageText) continue;
      const pageHeader = `[第 ${pageNum} 页]`;
      const remaining = MAX_DOCUMENT_CHARS - totalChars;
      const fullPage = `${pageHeader}\n${pageText}`;
      const clipped = fullPage.length > remaining ? fullPage.slice(0, remaining) : fullPage;
      if (clipped.length < fullPage.length) truncated = true;
      pages.push(clipped);
      totalChars += clipped.length;
    }
  } finally {
    await pdf.destroy();
  }

  return {
    text: normalizeExtractedText(pages.join("\n\n")),
    truncated,
  };
}

export function formatAttachmentSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export async function prepareAttachmentFiles(files: File[]): Promise<PrepareAttachmentResult> {
  const attachments: PreparedAttachment[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (file.type.startsWith("image/")) {
      if (file.size > MAX_IMAGE_BYTES) {
        errors.push(`${file.name} 超过 8 MB，暂未添加。`);
        continue;
      }
      try {
        attachments.push({
          id: makeId(),
          kind: "image",
          name: file.name,
          mime: file.type || "image/*",
          size: file.size,
          dataUrl: await readAsDataUrl(file),
        });
      } catch (err) {
        errors.push(`${file.name} 读取失败：${err instanceof Error ? err.message : String(err)}`);
      }
      continue;
    }

    if (isPdf(file)) {
      if (file.size > MAX_PDF_BYTES) {
        errors.push(`${file.name} 超过 32 MB，暂未添加。`);
        continue;
      }
      try {
        const { text, truncated } = await extractPdfText(file);
        if (!text) {
          errors.push(`${file.name} 没有抽取到可读文本，可能是扫描版 PDF。请先 OCR 后再上传。`);
          continue;
        }
        attachments.push({
          id: makeId(),
          kind: "document",
          name: file.name,
          mime: file.type || "application/pdf",
          size: file.size,
          text,
          truncated,
        });
      } catch (err) {
        errors.push(`${file.name} 解析失败：${err instanceof Error ? err.message : String(err)}`);
      }
      continue;
    }

    if (!isTextLike(file)) {
      errors.push(`${file.name} 暂不支持读取。当前支持图片、PDF、txt、md、csv、json 和代码文本。`);
      continue;
    }

    if (file.size > MAX_DOCUMENT_BYTES) {
      errors.push(`${file.name} 超过 2 MB，暂未添加。`);
      continue;
    }

    try {
      const raw = await file.text();
      if (!isProbablyText(raw)) {
        errors.push(`${file.name} 看起来不是可读取文本，暂未添加。`);
        continue;
      }
      const truncated = raw.length > MAX_DOCUMENT_CHARS;
      const text = truncated ? raw.slice(0, MAX_DOCUMENT_CHARS) : raw;
      attachments.push({
        id: makeId(),
        kind: "document",
        name: file.name,
        mime: file.type || "text/plain",
        size: file.size,
        text,
        truncated,
      });
    } catch (err) {
      errors.push(`${file.name} 读取失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { attachments, errors };
}

export function buildAttachmentPrompt(
  text: string,
  attachments: PreparedAttachment[]
): string {
  const trimmed = text.trim();
  const lines: string[] = [];
  lines.push(trimmed || "请根据我上传的附件内容进行分析。");

  const documents = attachments.filter((a) => a.kind === "document");
  const images = attachments.filter((a) => a.kind === "image");

  if (images.length > 0) {
    lines.push("");
    lines.push("已上传图片：");
    for (const image of images) {
      lines.push(`- ${image.name} (${image.mime}, ${formatAttachmentSize(image.size)})`);
    }
  }

  for (const doc of documents) {
    lines.push("");
    lines.push(`--- 文档开始：${doc.name} (${doc.mime}, ${formatAttachmentSize(doc.size)}) ---`);
    lines.push(doc.text ?? "");
    if (doc.truncated) {
      lines.push("");
      lines.push(`[文档过长，已截取前 ${MAX_DOCUMENT_CHARS} 个字符。]`);
    }
    lines.push(`--- 文档结束：${doc.name} ---`);
  }

  return lines.join("\n");
}

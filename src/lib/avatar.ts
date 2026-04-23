const MAX_DIM = 256;
const JPEG_QUALITY = 0.88;

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("读取失败"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

export async function fileToAvatarDataURL(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件");
  }
  const rawDataUrl = await readFileAsDataURL(file);
  const img = await loadImage(rawDataUrl);

  const { width, height } = img;
  const size = Math.min(width, height);
  const sx = (width - size) / 2;
  const sy = (height - size) / 2;

  const target = Math.min(size, MAX_DIM);
  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不可用");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, size, size, 0, 0, target, target);

  const hasAlpha = file.type === "image/png" || file.type === "image/webp";
  const mime = hasAlpha ? "image/png" : "image/jpeg";
  return canvas.toDataURL(mime, JPEG_QUALITY);
}

export function avatarInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Lit";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2);
}

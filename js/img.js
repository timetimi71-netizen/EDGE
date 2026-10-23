// Edge · Bilder vorbereiten: einmal dekodieren, verkleinern, als JPEG speichern. Leinwände danach freigeben (iOS hat wenig Canvas-Speicher).
import { blobToDataURL } from './util.js';

async function loadImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function fit(src, w, h, max) {
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
const toJPEG = (c, q) => new Promise((r) => c.toBlob(r, 'image/jpeg', q)).then((b) => b || fetch(c.toDataURL('image/jpeg', q)).then((x) => x.blob()));

// Chart-Screenshot zum Speichern
export async function prepareChart(file, max = 1500) {
  const img = await loadImage(file);
  const c = fit(img, img.naturalWidth, img.naturalHeight, max);
  const blob = await toJPEG(c, 0.82);
  c.width = c.height = 0;
  if (!blob?.size) throw new Error('Bild leer');
  return blob;
}
// Screenshot für Gemini: groß genug, damit kleine Zahlen lesbar bleiben
export async function prepareForAI(file, max = 2000) {
  const img = await loadImage(file);
  const c = fit(img, img.naturalWidth, img.naturalHeight, max);
  const blob = await toJPEG(c, 0.86);
  c.width = c.height = 0;
  if (!blob?.size) throw new Error('Bild leer');
  return { b64: (await blobToDataURL(blob)).split(',')[1], blob };
}

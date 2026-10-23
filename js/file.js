// Edge · Dateien sichern: auf dem iPhone über das Teilen-Menü („In Dateien sichern“), sonst als Download.
import { IS_IOS, IS_PREVIEW } from './util.js';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function saveFile(blob, filename) {
  if (IS_PREVIEW) {
    const dl = await window.claude?.use?.('downloads');
    if (!dl) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
    await dl.save({ filename, data: blob });
    return 'saved';
  }
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  if (IS_IOS && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
    return 'shared';
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

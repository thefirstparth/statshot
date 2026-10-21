/**
 * PNG export: a one-entry blob cache plus share / copy / download.
 *
 * iOS Safari drops the user gesture if navigator.share() follows slow async work, so the PNG is
 * pre-rendered after options settle and Share uses the cached blob straight away.
 */

let cacheKey: string | null = null;
let cacheBlob: Blob | null = null;

export function cachedBlob(key: string): Blob | null {
  return key === cacheKey ? cacheBlob : null;
}

export function setCachedBlob(key: string, blob: Blob): void {
  cacheKey = key;
  cacheBlob = blob;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png');
  });
}

/** Synchronous PNG encode, for when the cache is stale at click time. */
export function canvasToBlobSync(canvas: HTMLCanvasElement): Blob {
  const url = canvas.toDataURL('image/png');
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}

export function pngFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: 'image/png' });
}

let shareSupport: boolean | null = null;

/** Whether this browser can share PNG files (iOS/Android share sheet). */
export function canShareFiles(): boolean {
  if (shareSupport === null) {
    try {
      const probe = pngFile(new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), 'probe.png');
      shareSupport =
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [probe] });
    } catch {
      shareSupport = false;
    }
  }
  return shareSupport;
}

/** Whether PNG images can be written to the clipboard. */
export function canCopyImages(): boolean {
  try {
    if (typeof ClipboardItem === 'undefined' || typeof navigator.clipboard?.write !== 'function') return false;
    const supports = (ClipboardItem as unknown as { supports?: (type: string) => boolean }).supports;
    return supports ? supports('image/png') : true;
  } catch {
    return false;
  }
}

/** Call synchronously from the click handler with an already-available blob. */
export function shareBlob(blob: Blob, filename: string, title: string): Promise<void> {
  return navigator.share({ files: [pngFile(blob, filename)], title });
}

/**
 * Call synchronously from the click handler. The promise goes straight into ClipboardItem,
 * which is the pattern Safari accepts.
 */
export function copyBlob(blob: Promise<Blob>): Promise<void> {
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** sweatshot-<sport>-<yyyy-mm-dd>.png */
export function exportFilename(sportSlug: string, isoDate: string): string {
  return `sweatshot-${sportSlug}-${isoDate}.png`;
}

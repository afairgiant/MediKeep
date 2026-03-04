/**
 * Trigger a file download from a Blob.
 *
 * @param {Blob} blob - The blob data to download
 * @param {string} filename - The suggested filename for the download
 */
export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}

/**
 * Generate a filesystem-safe timestamp string for export filenames.
 * Example output: "2026-02-26T14-30-00"
 *
 * @returns {string}
 */
export function exportTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

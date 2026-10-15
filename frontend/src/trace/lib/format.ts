/** Small formatting helpers shared across the research site. */

/** 1 536 000 -> "1.5 MB". Decimal units, because that is what file managers show. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(0)} kB`;
  return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
}

/** 7140 -> "7 140". Thin spaces, so long counts stay readable in tables. */
export function formatCount(value: number): string {
  return value.toLocaleString('en-GB').replace(/,/g, '\u202f');
}

/** "chest-xray-001.png" -> "chest-xray-001" / "PNG" */
export function splitFilename(name: string): { base: string; extension: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { base: name, extension: '' };
  return { base: name.slice(0, dot), extension: name.slice(dot + 1).toUpperCase() };
}

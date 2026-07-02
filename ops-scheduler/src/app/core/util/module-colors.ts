/** Pastel palette, distinct enough to tell modules apart while keeping black text legible. */
const PALETTE: readonly string[] = [
  'FFAEC6E8',
  'FFFFD8A8',
  'FFB8E6B8',
  'FFF4A8C6',
  'FFFFF3A0',
  'FFC3B8F0',
  'FFA8E0DC',
  'FFF0B8A8',
  'FFD0D0D0',
  'FFB8D0F0',
  'FFE8C39A',
  'FFC6E8A8',
  'FFF0A8D8',
  'FFA8C6F0',
  'FFE0E0A8',
  'FFB8F0D0',
  'FFF0C6A8',
  'FFC6A8F0',
  'FFA8F0E0',
  'FFF0D0B8'
];

/** Assigns a stable color to each module id, in ascending id order, cycling through the palette. */
export function buildModuleColorMap(moduleIds: Iterable<number>): Map<number, string> {
  const uniqueSorted = Array.from(new Set(moduleIds)).sort((a, b) => a - b);
  const colors = new Map<number, string>();
  uniqueSorted.forEach((id, index) => colors.set(id, PALETTE[index % PALETTE.length]));
  return colors;
}

/** Palette for category charts when a category has no custom color set. */
export const CATEGORY_PALETTE = [
  '#8b46e8', // brand-500
  '#f472b6', // pink
  '#fb923c', // orange
  '#facc15', // yellow
  '#34d399', // green
  '#38bdf8', // sky
  '#a78bfa', // violet
  '#f87171', // red
  '#2dd4bf', // teal
  '#c084fc', // purple
]

export function colorForIndex(index: number): string {
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]
}

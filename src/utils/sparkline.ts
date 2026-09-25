/**
 * Pure SVG geometry for single-series sparklines (spec 006 stat tiles).
 * Returns polyline points scaled into a width × height box with `pad` px of
 * inset, plus the last point (for the end marker). A flat or single-value
 * series is drawn at mid-height.
 */
export interface SparklineGeometry {
  points: string;
  last: { x: number; y: number } | null;
}

export function sparkline(values: number[], width: number, height: number, pad = 4): SparklineGeometry {
  if (values.length === 0) return { points: '', last: null };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const stepX = values.length > 1 ? (width - 2 * pad) / (values.length - 1) : 0;
  const coords = values.map((v, i) => {
    const x = values.length > 1 ? pad + i * stepX : width / 2;
    const y = span === 0 ? height / 2 : pad + (1 - (v - min) / span) * (height - 2 * pad);
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  });
  return {
    points: coords.map((c) => `${c.x},${c.y}`).join(' '),
    last: coords[coords.length - 1] ?? null,
  };
}

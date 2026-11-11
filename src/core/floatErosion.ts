/**
 * Float erosion: how the total float of open activities changed since the previous saved month.
 * A schedule can show a healthy SPI while the float on the driving path is being used up.
 */
import type { CalcRow } from './engine';
import type { Snapshot } from './snapshot';

export interface FloatErosion {
  prevDate: number;
  projectFloatNow: number | null;
  projectFloatPrev: number | null;
  /** open activities in both months whose float went down, worst first */
  eroded: { id: string; name: string; prev: number; now: number; change: number; critical: boolean }[];
  compared: number;
}

/** null when the previous snapshot was saved before float was recorded. */
export function floatErosion(rows: CalcRow[], prev: Snapshot | null): FloatErosion | null {
  if (!prev || !prev.activities.some((a) => a.tf !== undefined)) return null;
  const before = new Map(prev.activities.filter((a) => a.tf != null).map((a) => [a.id.toLowerCase(), a.tf!]));
  const open = rows.filter((r) => r.included && r.status !== 'Completed' && r.tfDays != null && r.a.id);
  const eroded: FloatErosion['eroded'] = [];
  let compared = 0;
  for (const r of open) {
    const p = before.get(r.a.id.toLowerCase());
    if (p == null) continue;
    compared++;
    const change = r.tfDays! - p;
    if (change < -1e-9) eroded.push({ id: r.a.id, name: r.a.name, prev: p, now: r.tfDays!, change, critical: r.critical });
  }
  eroded.sort((a, b) => a.change - b.change || a.now - b.now);
  const nowMin = open.length ? open.reduce((m, r) => Math.min(m, r.tfDays!), Infinity) : null;
  return { prevDate: prev.dataDate, projectFloatNow: nowMin, projectFloatPrev: prev.summary.projectFloat ?? null, eroded, compared };
}

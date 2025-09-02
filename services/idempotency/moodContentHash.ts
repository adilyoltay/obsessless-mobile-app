export type MoodContentInput = {
  user_id: string;
  mood_score: number;
  energy_level: number;
  anxiety_level: number;
  notes?: string;
  timestamp?: string | number | Date;
};

export type MoodHashOptions = {
  dayMode?: 'UTC' | 'LOCAL';
};

function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, num));
}

function normalizeDay(ts: string | number | Date | undefined, mode: 'UTC' | 'LOCAL'): string {
  const d = ts ? new Date(ts) : new Date();
  if (mode === 'LOCAL') {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${day}`;
  } else {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Compute canonical content hash for mood idempotency.
 * - Normalizes text (trim+lowercase)
 * - Rounds and clamps numbers to DB constraints (mood 0-100, energy/anxiety 1-10)
 * - Uses UTC day key by default for cross-device consistency
 */
export function computeMoodContentHash(input: MoodContentInput, opts: MoodHashOptions = {}): string {
  const dayMode = opts.dayMode || 'UTC';
  const notes = (input.notes || '').trim().toLowerCase();
  const mood = clamp(Math.round(Number(input.mood_score || 0)), 0, 100);
  const energy = clamp(Math.round(Number(input.energy_level || 0)), 1, 10);
  const anxiety = clamp(Math.round(Number(input.anxiety_level || 0)), 1, 10);
  const day = normalizeDay(input.timestamp, dayMode);

  const contentText = `${input.user_id}|${mood}|${energy}|${anxiety}|${notes}|${day}`;
  let hash = 0;
  for (let i = 0; i < contentText.length; i++) {
    const char = contentText.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}


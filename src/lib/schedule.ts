import type { ScheduleMilestone } from '../types.js';

/** No inferred or demo milestones may enter real customer invitations. */
export function normalizeSchedule(value: unknown): ScheduleMilestone[] {
  if (!Array.isArray(value) || value.length > 4) throw new Error('Choose up to four schedule milestones');
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid schedule milestone');
    const { time, label } = item as Record<string, unknown>;
    if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time.trim())) throw new Error('Enter a valid milestone time');
    if (typeof label !== 'string' || !label.trim() || label.trim().length > 100) throw new Error('Milestone descriptions must contain 1–100 characters');
    return { time: time.trim(), label: label.trim() };
  });
}

export function visibleSchedule(value: unknown): ScheduleMilestone[] {
  try { return normalizeSchedule(value); } catch { return []; }
}
export function scheduleTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

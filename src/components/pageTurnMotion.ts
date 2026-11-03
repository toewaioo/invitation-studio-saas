/** Button/keyboard turns start and stop at rest; swipe settling stays responsive. */
export function pageTurnEase(progress: number, smoothStart = false): number {
  const p = Math.max(0, Math.min(1, progress));
  return smoothStart ? p * p * (3 - 2 * p) : 1 - Math.pow(1 - p, 3);
}

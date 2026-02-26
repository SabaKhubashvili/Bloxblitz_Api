export function getRakebackRate(level: number): number {
  if (level >= 90) return 0.15;
  if (level >= 70) return 0.12;
  if (level >= 50) return 0.10;
  if (level >= 30) return 0.07;
  if (level >= 10) return 0.05;
  return 0.01;
}
export function pickRandom<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty collection.");
  }
  return items[Math.floor(Math.random() * items.length)] as T;
}

export function randomInt(min: number, max: number): number {
  if (max < min) {
    throw new Error("max must be >= min");
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index] as T;
    copy[index] = copy[swapIndex] as T;
    copy[swapIndex] = current;
  }
  return copy;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

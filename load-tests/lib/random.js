export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickWeighted(entries) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let choice = Math.random() * total;
  for (const entry of entries) {
    choice -= entry.weight;
    if (choice < 0) return entry;
  }
  return entries[entries.length - 1];
}

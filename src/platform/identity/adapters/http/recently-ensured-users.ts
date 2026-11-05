export function createRecentlyEnsuredUsers(options: { ttlMs: number; maxEntries: number }): {
  has(id: string): boolean;
  remember(id: string): void;
} {
  const ensuredUsers = new Map<string, number>();

  return {
    has(id) {
      const ensuredAt = ensuredUsers.get(id);
      return ensuredAt !== undefined && Date.now() - ensuredAt < options.ttlMs;
    },
    remember(id) {
      ensuredUsers.delete(id);
      if (ensuredUsers.size >= options.maxEntries) {
        const oldest = ensuredUsers.keys().next().value;
        if (oldest !== undefined) {
          ensuredUsers.delete(oldest);
        }
      }
      ensuredUsers.set(id, Date.now());
    },
  };
}

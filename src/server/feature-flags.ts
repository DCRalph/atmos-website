import { db } from "~/server/db";

/**
 * Read a feature-flag-style value from the KeyValueStore. Returns `null` if
 * the key is not set. Writes should go through admin-only tooling.
 */
export async function getKeyValue(key: string): Promise<string | null> {
  const row = await db.keyValueStore
    .findUnique({ where: { key } })
    .catch(() => null);
  return row?.value ?? null;
}

export async function setKeyValue(key: string, value: string): Promise<void> {
  await db.keyValueStore.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/**
 * Feature flag helpers. A flag is considered enabled when the stored value
 * is strictly "true". Missing values default to `defaultEnabled`.
 */
export async function isFeatureEnabled(
  flag: string,
  defaultEnabled = false,
): Promise<boolean> {
  const value = await getKeyValue(flag);
  if (value === null || value === undefined) return defaultEnabled;
  return value === "true";
}

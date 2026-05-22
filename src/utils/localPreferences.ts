export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const hintVisualEffectsKey = "longwave:hintVisualEffects";
export const hintSoundEffectsKey = "longwave:hintSoundEffects";

export function readBooleanPreference(storage: StorageLike, key: string, defaultValue: boolean) {
  const rawValue = storage.getItem(key);
  if (rawValue === null) {
    storage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try {
    return Boolean(JSON.parse(rawValue));
  } catch (error) {
    storage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
}

export function writeBooleanPreference(storage: StorageLike, key: string, value: boolean) {
  storage.setItem(key, JSON.stringify(value));
}

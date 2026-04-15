export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const playerNamePrefix = "playerName:";
const migrationQueryParam = "migrate";

function storageGetJSON<T>(storage: StorageLike, key: string): T | null {
  const rawValue = storage.getItem(key);
  if (rawValue === null) {
    return null;
  }
  try {
    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.warn(`Invalid JSON in localStorage for ${key}, resetting`, error);
    return null;
  }
}

function storageSetJSON<T>(storage: StorageLike, key: string, value: T) {
  storage.setItem(key, JSON.stringify(value));
}

export function getPlayerNameStorageKey(roomId: string) {
  return `${playerNamePrefix}${roomId}`;
}

export function readStoredPlayerName(storage: StorageLike, storageKey: string) {
  return storageGetJSON<string>(storage, storageKey) ?? "";
}

export function writeStoredPlayerName(
  storage: StorageLike,
  storageKey: string,
  playerName: string
) {
  storageSetJSON(storage, storageKey, playerName);
}

export function buildCanonicalRoomUrl(origin: string, roomId: string) {
  return `${origin}/${encodeURIComponent(roomId)}`;
}

export function buildMigratedRoomUrl(origin: string, roomId: string, migrationKey: string) {
  const url = new URL(buildCanonicalRoomUrl(origin, roomId));
  url.searchParams.set(migrationQueryParam, migrationKey);
  return url.toString();
}

export function getMigrationKey(search: string) {
  const migrationKey = new URLSearchParams(search).get(migrationQueryParam);
  return migrationKey && migrationKey.trim().length > 0
    ? migrationKey.trim()
    : null;
}

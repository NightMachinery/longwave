export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const legacyPlayerNamePrefix = "playerName:";
const playerNameStorageKey = "playerName";
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
  return `${legacyPlayerNamePrefix}${roomId}`;
}

export function getGlobalPlayerNameStorageKey() {
  return playerNameStorageKey;
}

export function readStoredPlayerName(storage: StorageLike, roomId?: string) {
  const globalName = storageGetJSON<string>(storage, playerNameStorageKey);
  if (globalName && globalName.trim().length > 0) {
    return globalName;
  }
  if (!roomId) {
    return "";
  }
  return storageGetJSON<string>(storage, getPlayerNameStorageKey(roomId)) ?? "";
}

export function writeStoredPlayerName(storage: StorageLike, playerName: string) {
  storageSetJSON(storage, playerNameStorageKey, playerName);
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

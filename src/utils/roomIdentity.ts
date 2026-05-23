export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const legacyPlayerNamePrefix = "playerName:";
const playerNameStorageKey = "playerName";
const userAuthStorageKey = "longwave:userAuthToken";
const userProfileStorageKey = "longwave:userProfile";
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

export function getUserAuthStorageKey() {
  return userAuthStorageKey;
}

export function readOrCreateUserAuthToken(storage: StorageLike) {
  const existing = storageGetJSON<string>(storage, userAuthStorageKey);
  if (existing && existing.trim().length > 0) {
    return existing;
  }
  const token = createRandomToken();
  storageSetJSON(storage, userAuthStorageKey, token);
  return token;
}

export function readStoredUserDisplayName(storage: StorageLike) {
  const profile = storageGetJSON<{ authToken?: string; displayName?: string }>(
    storage,
    userProfileStorageKey
  );
  if (profile?.displayName && profile.displayName.trim().length > 0) {
    return profile.displayName;
  }
  return storageGetJSON<string>(storage, playerNameStorageKey) ?? "";
}

export function writeStoredUserDisplayName(
  storage: StorageLike,
  authToken: string,
  displayName: string
) {
  storageSetJSON(storage, userProfileStorageKey, { authToken, displayName });
  storageSetJSON(storage, playerNameStorageKey, displayName);
}

export function readStoredPlayerName(storage: StorageLike, roomId?: string) {
  const globalName = readStoredUserDisplayName(storage);
  if (globalName && globalName.trim().length > 0) {
    return globalName;
  }
  if (!roomId) {
    return "";
  }
  return storageGetJSON<string>(storage, getPlayerNameStorageKey(roomId)) ?? "";
}

export function writeStoredPlayerName(storage: StorageLike, playerName: string) {
  writeStoredUserDisplayName(storage, readOrCreateUserAuthToken(storage), playerName);
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

function createRandomToken() {
  const bytes = new Uint8Array(32);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

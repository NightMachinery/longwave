export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const userAuthTokenStorageKey = "userAuthToken";
const roomAuthIdPrefix = "roomAuthId:";
const playerNamePrefix = "playerName:";
const roomAuthQueryParam = "roomAuth";

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

export function generateOpaqueToken(byteLength = 16) {
  const bytes = new Uint8Array(byteLength);

  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function getOrCreateUserAuthToken(storage: StorageLike) {
  const storedToken = storageGetJSON<string>(storage, userAuthTokenStorageKey);
  if (storedToken) {
    return storedToken;
  }

  const nextToken = generateOpaqueToken();
  storageSetJSON(storage, userAuthTokenStorageKey, nextToken);
  return nextToken;
}

function roomAuthStorageKey(roomId: string, userAuthToken: string) {
  return `${roomAuthIdPrefix}${roomId}:${userAuthToken}`;
}

export function getOrCreateStoredRoomAuthId(
  storage: StorageLike,
  roomId: string,
  userAuthToken: string
) {
  const storageKey = roomAuthStorageKey(roomId, userAuthToken);
  const storedRoomAuthId = storageGetJSON<string>(storage, storageKey);
  if (storedRoomAuthId) {
    return storedRoomAuthId;
  }

  const nextRoomAuthId = generateOpaqueToken();
  storageSetJSON(storage, storageKey, nextRoomAuthId);
  return nextRoomAuthId;
}

export function getRoomAuthOverride(search: string) {
  const roomAuthOverride = new URLSearchParams(search).get(roomAuthQueryParam);
  return roomAuthOverride && roomAuthOverride.trim().length > 0
    ? roomAuthOverride.trim()
    : null;
}

export function resolveRoomIdentity(
  storage: StorageLike,
  roomId: string,
  search: string
) {
  const userAuthToken = getOrCreateUserAuthToken(storage);
  const storedRoomAuthId = getOrCreateStoredRoomAuthId(
    storage,
    roomId,
    userAuthToken
  );
  const roomAuthOverride = getRoomAuthOverride(search);
  const usesRoomAuthOverride = roomAuthOverride !== null;

  return {
    userAuthToken,
    storedRoomAuthId,
    effectiveRoomAuthId: roomAuthOverride ?? storedRoomAuthId,
    usesRoomAuthOverride,
  };
}

export function getPlayerNameStorageKey(args: {
  userAuthToken: string;
  effectiveRoomAuthId: string;
  usesRoomAuthOverride: boolean;
}) {
  const scope = args.usesRoomAuthOverride
    ? args.effectiveRoomAuthId
    : args.userAuthToken;

  return `${playerNamePrefix}${scope}`;
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

export function buildMigratedRoomUrl(
  origin: string,
  roomId: string,
  roomAuthId: string
) {
  const url = new URL(buildCanonicalRoomUrl(origin, roomId));
  url.searchParams.set(roomAuthQueryParam, roomAuthId);
  return url.toString();
}

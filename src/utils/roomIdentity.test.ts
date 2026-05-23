import {
  buildCanonicalRoomUrl,
  buildMigratedRoomUrl,
  getGlobalPlayerNameStorageKey,
  getMigrationKey,
  getPlayerNameStorageKey,
  getUserAuthStorageKey,
  readOrCreateUserAuthToken,
  readStoredPlayerName,
  readStoredUserDisplayName,
  writeStoredUserDisplayName,
  writeStoredPlayerName,
} from "./roomIdentity";

describe("roomIdentity", () => {
  function createStorage() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
  }

  it("stores player names globally", () => {
    const storage = createStorage();
    const storageKey = getGlobalPlayerNameStorageKey();

    writeStoredPlayerName(storage, "Alice");

    expect(storage.getItem(storageKey)).toBe(JSON.stringify("Alice"));
    expect(readStoredPlayerName(storage, "ROOM")).toBe("Alice");
  });

  it("creates and reuses a user auth token", () => {
    const storage = createStorage();
    const firstToken = readOrCreateUserAuthToken(storage);
    const secondToken = readOrCreateUserAuthToken(storage);

    expect(firstToken).toHaveLength(64);
    expect(secondToken).toBe(firstToken);
    expect(storage.getItem(getUserAuthStorageKey())).toBe(JSON.stringify(firstToken));
  });

  it("stores display names with the user profile", () => {
    const storage = createStorage();
    writeStoredUserDisplayName(storage, "auth-token", "Alice");

    expect(readStoredUserDisplayName(storage)).toBe("Alice");
    expect(readStoredPlayerName(storage, "ROOM")).toBe("Alice");
  });

  it("falls back to a legacy room-specific name when no global name exists", () => {
    const storage = createStorage();
    storage.setItem(getPlayerNameStorageKey("ROOM"), JSON.stringify("Legacy Alice"));

    expect(readStoredPlayerName(storage, "ROOM")).toBe("Legacy Alice");
  });

  it("builds canonical room urls without query parameters", () => {
    expect(buildCanonicalRoomUrl("http://example.com", "ROOM")).toBe(
      "http://example.com/ROOM"
    );
  });

  it("builds migrated room urls with the migrate query parameter", () => {
    expect(buildMigratedRoomUrl("http://example.com", "ROOM", "abc123")).toBe(
      "http://example.com/ROOM?migrate=abc123"
    );
  });

  it("reads migration keys from room urls", () => {
    expect(getMigrationKey("?migrate=abc123")).toBe("abc123");
  });
});

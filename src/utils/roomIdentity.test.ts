import {
  buildCanonicalRoomUrl,
  buildMigratedRoomUrl,
  getMigrationKey,
  getPlayerNameStorageKey,
  readStoredPlayerName,
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

  it("stores player names by room id", () => {
    const storage = createStorage();
    const storageKey = getPlayerNameStorageKey("ROOM");

    writeStoredPlayerName(storage, storageKey, "Alice");

    expect(readStoredPlayerName(storage, storageKey)).toBe("Alice");
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

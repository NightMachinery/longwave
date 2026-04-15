import {
  buildCanonicalRoomUrl,
  buildMigratedRoomUrl,
  getOrCreateStoredRoomAuthId,
  getOrCreateUserAuthToken,
  getPlayerNameStorageKey,
  readStoredPlayerName,
  resolveRoomIdentity,
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

  it("creates and reuses a user auth token", () => {
    const storage = createStorage();

    const firstToken = getOrCreateUserAuthToken(storage);
    const secondToken = getOrCreateUserAuthToken(storage);

    expect(firstToken).toHaveLength(32);
    expect(secondToken).toBe(firstToken);
  });

  it("reuses the same stored room auth id for the same room and user auth token", () => {
    const storage = createStorage();
    const userAuthToken = getOrCreateUserAuthToken(storage);

    const firstRoomAuthId = getOrCreateStoredRoomAuthId(
      storage,
      "ROOM",
      userAuthToken
    );
    const secondRoomAuthId = getOrCreateStoredRoomAuthId(
      storage,
      "ROOM",
      userAuthToken
    );

    expect(firstRoomAuthId).toHaveLength(32);
    expect(secondRoomAuthId).toBe(firstRoomAuthId);
  });

  it("uses roomAuth query overrides without replacing the stored device identity", () => {
    const storage = createStorage();
    const defaultIdentity = resolveRoomIdentity(storage, "ROOM", "");

    const migratedIdentity = resolveRoomIdentity(
      storage,
      "ROOM",
      "?roomAuth=migrated-room-auth"
    );

    expect(migratedIdentity.effectiveRoomAuthId).toBe("migrated-room-auth");
    expect(migratedIdentity.storedRoomAuthId).toBe(defaultIdentity.storedRoomAuthId);
    expect(migratedIdentity.userAuthToken).toBe(defaultIdentity.userAuthToken);
    expect(migratedIdentity.usesRoomAuthOverride).toBe(true);
  });

  it("stores player names by the active auth scope", () => {
    const storage = createStorage();
    const defaultIdentity = resolveRoomIdentity(storage, "ROOM", "");
    const migratedIdentity = resolveRoomIdentity(storage, "ROOM", "?roomAuth=shared-room-auth");

    const defaultNameKey = getPlayerNameStorageKey(defaultIdentity);
    const migratedNameKey = getPlayerNameStorageKey(migratedIdentity);

    writeStoredPlayerName(storage, defaultNameKey, "Alice");
    writeStoredPlayerName(storage, migratedNameKey, "Bob");

    expect(readStoredPlayerName(storage, defaultNameKey)).toBe("Alice");
    expect(readStoredPlayerName(storage, migratedNameKey)).toBe("Bob");
  });

  it("builds canonical room urls without query parameters", () => {
    expect(buildCanonicalRoomUrl("http://example.com", "ROOM")).toBe(
      "http://example.com/ROOM"
    );
  });

  it("builds migrated room urls with the roomAuth query parameter", () => {
    expect(
      buildMigratedRoomUrl("http://example.com", "ROOM", "shared-room-auth")
    ).toBe("http://example.com/ROOM?roomAuth=shared-room-auth");
  });
});

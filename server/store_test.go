package server

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

func TestSaveAndLoadRoom(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 4, 15, 12, 0, 0, 0, time.UTC)
	store := newTestStore(t, &now)
	defer func() {
		if err := store.Close(); err != nil {
			t.Fatalf("close store: %v", err)
		}
	}()

	ctx := context.Background()
	room := InitialRoomState("en")
	room.CreatorID = "player1"
	room.Players["player1"] = PlayerState{Name: "Alice", SessionSecret: "secret"}

	if err := store.SaveRoom(ctx, "ROOM", room); err != nil {
		t.Fatalf("save room: %v", err)
	}

	loadedRoom, found, err := store.LoadRoom(ctx, "ROOM", false)
	if err != nil {
		t.Fatalf("load room: %v", err)
	}
	if !found {
		t.Fatalf("expected room to be found")
	}
	if loadedRoom.CreatorID != "player1" {
		t.Fatalf("expected creator to round-trip, got %q", loadedRoom.CreatorID)
	}
	if loadedRoom.Players["player1"].Name != "Alice" {
		t.Fatalf("expected player to round-trip, got %#v", loadedRoom.Players["player1"])
	}
}

func TestDeleteExpiredRemovesOldRooms(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 4, 15, 12, 0, 0, 0, time.UTC)
	store := newTestStore(t, &now)
	defer func() {
		if err := store.Close(); err != nil {
			t.Fatalf("close store: %v", err)
		}
	}()

	ctx := context.Background()
	if err := store.SaveRoom(ctx, "ROOM", InitialRoomState("en")); err != nil {
		t.Fatalf("create room: %v", err)
	}

	now = now.Add(8 * 24 * time.Hour)
	if err := store.DeleteExpired(ctx); err != nil {
		t.Fatalf("delete expired rooms: %v", err)
	}

	_, found, err := store.LoadRoom(ctx, "ROOM", false)
	if err != nil {
		t.Fatalf("get room after cleanup: %v", err)
	}
	if found {
		t.Fatalf("expected expired room to be deleted")
	}
}

func newTestStore(t *testing.T, now *time.Time) *Store {
	t.Helper()

	store, err := OpenStore(filepath.Join(t.TempDir(), "rooms.sqlite"), 7*24*time.Hour, func() time.Time {
		return *now
	})
	if err != nil {
		t.Fatalf("open store: %v", err)
	}

	return store
}

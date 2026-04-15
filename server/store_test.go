package server

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"
	"time"
)

func TestPatchRoomUsesShallowTopLevelMerge(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 4, 15, 12, 0, 0, 0, time.UTC)
	store := newTestStore(t, &now)
	defer func() {
		if err := store.Close(); err != nil {
			t.Fatalf("close store: %v", err)
		}
	}()

	ctx := context.Background()
	initialState, err := store.PatchRoom(ctx, "ROOM", mustPatch(t, map[string]any{
		"guess": 7,
		"players": map[string]any{
			"p1": map[string]any{
				"name": "Alice",
			},
		},
	}))
	if err != nil {
		t.Fatalf("patch initial room: %v", err)
	}

	var initial map[string]any
	if err := json.Unmarshal(initialState, &initial); err != nil {
		t.Fatalf("decode initial state: %v", err)
	}
	if initial["guess"].(float64) != 7 {
		t.Fatalf("expected guess 7, got %#v", initial["guess"])
	}

	nextState, err := store.PatchRoom(ctx, "ROOM", mustPatch(t, map[string]any{
		"clue": "coffee",
		"players": map[string]any{
			"p2": map[string]any{
				"name": "Bob",
			},
		},
	}))
	if err != nil {
		t.Fatalf("patch next room state: %v", err)
	}

	var actual map[string]any
	if err := json.Unmarshal(nextState, &actual); err != nil {
		t.Fatalf("decode merged state: %v", err)
	}

	if actual["guess"].(float64) != 7 {
		t.Fatalf("expected guess to survive merge, got %#v", actual["guess"])
	}
	if actual["clue"].(string) != "coffee" {
		t.Fatalf("expected clue coffee, got %#v", actual["clue"])
	}

	players := actual["players"].(map[string]any)
	if _, ok := players["p1"]; ok {
		t.Fatalf("expected players to be replaced by top-level shallow merge, got %#v", players)
	}
	if _, ok := players["p2"]; !ok {
		t.Fatalf("expected replacement players map to include p2, got %#v", players)
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
	if _, err := store.PatchRoom(ctx, "ROOM", mustPatch(t, map[string]any{
		"guess": 3,
	})); err != nil {
		t.Fatalf("create room: %v", err)
	}

	now = now.Add(8 * 24 * time.Hour)
	if err := store.DeleteExpired(ctx); err != nil {
		t.Fatalf("delete expired rooms: %v", err)
	}

	_, found, err := store.GetRoom(ctx, "ROOM", false)
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

func mustPatch(t *testing.T, payload map[string]any) map[string]json.RawMessage {
	t.Helper()

	encodedPayload, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("encode patch payload: %v", err)
	}

	var patch map[string]json.RawMessage
	if err := json.Unmarshal(encodedPayload, &patch); err != nil {
		t.Fatalf("decode patch payload: %v", err)
	}

	return patch
}

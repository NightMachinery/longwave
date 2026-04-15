package server

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type Store struct {
	db  *sql.DB
	now func() time.Time
	ttl time.Duration
	mu  sync.Mutex
}

func OpenStore(dbPath string, ttl time.Duration, now func() time.Time) (*Store, error) {
	if now == nil {
		now = time.Now
	}
	if dbPath != ":memory:" && filepath.Dir(dbPath) != "." {
		if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
			return nil, fmt.Errorf("create sqlite directory: %w", err)
		}
	}
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open sqlite database: %w", err)
	}
	store := &Store{db: db, now: now, ttl: ttl}
	if err := store.init(context.Background()); err != nil {
		_ = db.Close()
		return nil, err
	}
	return store, nil
}

func (store *Store) init(ctx context.Context) error {
	statements := []string{
		"PRAGMA journal_mode = WAL;",
		"PRAGMA busy_timeout = 5000;",
		`CREATE TABLE IF NOT EXISTS rooms (
			id TEXT PRIMARY KEY,
			payload TEXT NOT NULL,
			updated_at INTEGER NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms(updated_at);`,
	}
	for _, statement := range statements {
		if _, err := store.db.ExecContext(ctx, statement); err != nil {
			return fmt.Errorf("initialize sqlite database: %w", err)
		}
	}
	return nil
}

func (store *Store) Close() error { return store.db.Close() }

func (store *Store) LoadRoom(ctx context.Context, roomID string, touch bool) (RoomState, bool, error) {
	var room RoomState
	var payload string
	var updatedAtUnix int64
	err := store.db.QueryRowContext(ctx, `SELECT payload, updated_at FROM rooms WHERE id = ?`, roomID).Scan(&payload, &updatedAtUnix)
	if err == sql.ErrNoRows {
		return room, false, nil
	}
	if err != nil {
		return room, false, fmt.Errorf("get room %s: %w", roomID, err)
	}
	if store.isExpired(updatedAtUnix) {
		if err := store.deleteRoom(ctx, roomID); err != nil {
			return room, false, err
		}
		return room, false, nil
	}
	if err := json.Unmarshal([]byte(payload), &room); err != nil {
		return room, false, fmt.Errorf("decode room %s: %w", roomID, err)
	}
	if room.Players == nil {
		room.Players = map[string]PlayerState{}
	}
	if room.MigrationTokens == nil {
		room.MigrationTokens = map[string]string{}
	}
	if touch {
		if _, err := store.db.ExecContext(ctx, `UPDATE rooms SET updated_at = ? WHERE id = ?`, store.now().Unix(), roomID); err != nil {
			return room, false, fmt.Errorf("touch room %s: %w", roomID, err)
		}
	}
	return room, true, nil
}

func (store *Store) SaveRoom(ctx context.Context, roomID string, room RoomState) error {
	encoded, err := json.Marshal(room)
	if err != nil {
		return fmt.Errorf("encode room %s: %w", roomID, err)
	}
	if _, err := store.db.ExecContext(ctx, `INSERT INTO rooms(id, payload, updated_at) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`, roomID, string(encoded), store.now().Unix()); err != nil {
		return fmt.Errorf("upsert room %s: %w", roomID, err)
	}
	return nil
}

func (store *Store) UpdateRoom(ctx context.Context, roomID string, fn func(*RoomState, bool) error) (RoomState, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	room, found, err := store.LoadRoom(ctx, roomID, false)
	if err != nil {
		return RoomState{}, err
	}
	if !found {
		room = InitialRoomState("en")
	}
	if err := fn(&room, found); err != nil {
		return RoomState{}, err
	}
	if err := store.SaveRoom(ctx, roomID, room); err != nil {
		return RoomState{}, err
	}
	return room, nil
}

func (store *Store) DeleteExpired(ctx context.Context) error {
	if store.ttl <= 0 {
		return nil
	}
	cutoffUnix := store.now().Add(-store.ttl).Unix()
	if _, err := store.db.ExecContext(ctx, `DELETE FROM rooms WHERE updated_at < ?`, cutoffUnix); err != nil {
		return fmt.Errorf("delete expired rooms: %w", err)
	}
	return nil
}

func (store *Store) deleteRoom(ctx context.Context, roomID string) error {
	if _, err := store.db.ExecContext(ctx, `DELETE FROM rooms WHERE id = ?`, roomID); err != nil {
		return fmt.Errorf("delete room %s: %w", roomID, err)
	}
	return nil
}

func (store *Store) isExpired(updatedAtUnix int64) bool {
	if store.ttl <= 0 {
		return false
	}
	return time.Unix(updatedAtUnix, 0).Before(store.now().Add(-store.ttl))
}

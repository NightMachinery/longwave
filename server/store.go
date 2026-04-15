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

	store := &Store{
		db:  db,
		now: now,
		ttl: ttl,
	}

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

func (store *Store) Close() error {
	return store.db.Close()
}

func (store *Store) GetRoom(ctx context.Context, roomID string, touch bool) ([]byte, bool, error) {
	var payload string
	var updatedAtUnix int64

	err := store.db.QueryRowContext(
		ctx,
		`SELECT payload, updated_at FROM rooms WHERE id = ?`,
		roomID,
	).Scan(&payload, &updatedAtUnix)
	if err == sql.ErrNoRows {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("get room %s: %w", roomID, err)
	}

	if store.isExpired(updatedAtUnix) {
		if err := store.deleteRoom(ctx, roomID); err != nil {
			return nil, false, err
		}
		return nil, false, nil
	}

	if touch {
		if _, err := store.db.ExecContext(
			ctx,
			`UPDATE rooms SET updated_at = ? WHERE id = ?`,
			store.now().Unix(),
			roomID,
		); err != nil {
			return nil, false, fmt.Errorf("touch room %s: %w", roomID, err)
		}
	}

	return []byte(payload), true, nil
}

func (store *Store) PatchRoom(ctx context.Context, roomID string, patch map[string]json.RawMessage) ([]byte, error) {
	store.mu.Lock()
	defer store.mu.Unlock()

	tx, err := store.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin patch transaction: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	var currentPayload string
	var updatedAtUnix int64
	queryErr := tx.QueryRowContext(
		ctx,
		`SELECT payload, updated_at FROM rooms WHERE id = ?`,
		roomID,
	).Scan(&currentPayload, &updatedAtUnix)
	switch {
	case queryErr == nil:
		if store.isExpired(updatedAtUnix) {
			currentPayload = "{}"
			if _, err = tx.ExecContext(ctx, `DELETE FROM rooms WHERE id = ?`, roomID); err != nil {
				return nil, fmt.Errorf("delete expired room %s: %w", roomID, err)
			}
		}
	case queryErr == sql.ErrNoRows:
		currentPayload = "{}"
	default:
		return nil, fmt.Errorf("load existing room %s: %w", roomID, queryErr)
	}

	mergedPayload, err := mergeJSONObjects([]byte(currentPayload), patch)
	if err != nil {
		return nil, err
	}

	if _, err = tx.ExecContext(
		ctx,
		`INSERT INTO rooms(id, payload, updated_at) VALUES(?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
		roomID,
		string(mergedPayload),
		store.now().Unix(),
	); err != nil {
		return nil, fmt.Errorf("upsert room %s: %w", roomID, err)
	}

	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit patch transaction: %w", err)
	}
	committed = true

	return mergedPayload, nil
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

func mergeJSONObjects(existingPayload []byte, patch map[string]json.RawMessage) ([]byte, error) {
	existingObject := map[string]json.RawMessage{}
	if len(existingPayload) > 0 {
		if err := json.Unmarshal(existingPayload, &existingObject); err != nil {
			return nil, fmt.Errorf("decode existing room payload: %w", err)
		}
	}

	for key, value := range patch {
		existingObject[key] = value
	}

	mergedPayload, err := json.Marshal(existingObject)
	if err != nil {
		return nil, fmt.Errorf("encode merged room payload: %w", err)
	}

	return mergedPayload, nil
}

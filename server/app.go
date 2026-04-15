package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	defaultAddr            = "127.0.0.1:3310"
	defaultBuildDir        = "build"
	defaultDBPath          = ".self_host/data/rooms.sqlite"
	defaultRoomTTL         = 7 * 24 * time.Hour
	defaultCleanupInterval = time.Hour
	maxPatchBodySize       = 1 << 20
)

type Config struct {
	Addr            string
	BuildDir        string
	DBPath          string
	RoomTTL         time.Duration
	CleanupInterval time.Duration
	Now             func() time.Time
}

func ConfigFromEnv() (Config, error) {
	roomTTL := defaultRoomTTL
	if envRoomTTL := strings.TrimSpace(os.Getenv("LONGWAVE_ROOM_TTL")); envRoomTTL != "" {
		parsedTTL, err := time.ParseDuration(envRoomTTL)
		if err != nil {
			return Config{}, fmt.Errorf("parse LONGWAVE_ROOM_TTL: %w", err)
		}
		roomTTL = parsedTTL
	}

	cleanupInterval := defaultCleanupInterval
	if envCleanupInterval := strings.TrimSpace(os.Getenv("LONGWAVE_CLEANUP_INTERVAL")); envCleanupInterval != "" {
		parsedCleanupInterval, err := time.ParseDuration(envCleanupInterval)
		if err != nil {
			return Config{}, fmt.Errorf("parse LONGWAVE_CLEANUP_INTERVAL: %w", err)
		}
		cleanupInterval = parsedCleanupInterval
	}

	return Config{
		Addr:            firstNonEmpty(os.Getenv("LONGWAVE_ADDR"), defaultAddr),
		BuildDir:        firstNonEmpty(os.Getenv("LONGWAVE_BUILD_DIR"), defaultBuildDir),
		DBPath:          firstNonEmpty(os.Getenv("LONGWAVE_DB_PATH"), defaultDBPath),
		RoomTTL:         roomTTL,
		CleanupInterval: cleanupInterval,
	}, nil
}

type App struct {
	config      Config
	store       *Store
	hub         *RoomHub
	handler     http.Handler
	server      *http.Server
	cleanupStop chan struct{}
}

func New(config Config) (*App, error) {
	if config.Now == nil {
		config.Now = time.Now
	}
	if config.Addr == "" {
		config.Addr = defaultAddr
	}
	if config.BuildDir == "" {
		config.BuildDir = defaultBuildDir
	}
	if config.DBPath == "" {
		config.DBPath = defaultDBPath
	}
	if config.RoomTTL <= 0 {
		config.RoomTTL = defaultRoomTTL
	}
	if config.CleanupInterval <= 0 {
		config.CleanupInterval = defaultCleanupInterval
	}

	indexPath := filepath.Join(config.BuildDir, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		return nil, fmt.Errorf("build output missing at %s: %w", indexPath, err)
	}

	store, err := OpenStore(config.DBPath, config.RoomTTL, config.Now)
	if err != nil {
		return nil, err
	}

	app := &App{
		config:      config,
		store:       store,
		hub:         NewRoomHub(),
		cleanupStop: make(chan struct{}),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", app.handleHealthz)
	mux.HandleFunc("GET /api/rooms/{roomID}", app.handleGetRoom)
	mux.HandleFunc("PATCH /api/rooms/{roomID}", app.handlePatchRoom)
	mux.HandleFunc("GET /api/rooms/{roomID}/events", app.handleRoomEvents)
	mux.Handle("/", spaHandler(config.BuildDir))

	app.handler = mux
	app.server = &http.Server{
		Addr:    config.Addr,
		Handler: mux,
	}

	if err := app.store.DeleteExpired(context.Background()); err != nil {
		return nil, fmt.Errorf("cleanup expired rooms: %w", err)
	}

	go app.cleanupExpiredRooms()

	return app, nil
}

func (app *App) Handler() http.Handler {
	return app.handler
}

func (app *App) ListenAndServe() error {
	return app.server.ListenAndServe()
}

func (app *App) Close() error {
	close(app.cleanupStop)
	app.hub.Close()

	var closeErrors []error
	if app.server != nil {
		if err := app.server.Close(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			closeErrors = append(closeErrors, err)
		}
	}
	if app.store != nil {
		if err := app.store.Close(); err != nil {
			closeErrors = append(closeErrors, err)
		}
	}

	return errors.Join(closeErrors...)
}

func (app *App) cleanupExpiredRooms() {
	ticker := time.NewTicker(app.config.CleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := app.store.DeleteExpired(context.Background()); err != nil {
				log.Printf("failed to delete expired rooms: %v", err)
			}
		case <-app.cleanupStop:
			return
		}
	}
}

func (app *App) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("ok\n"))
}

func (app *App) handleGetRoom(w http.ResponseWriter, r *http.Request) {
	roomID := strings.TrimSpace(r.PathValue("roomID"))
	if roomID == "" {
		writeJSONError(w, http.StatusBadRequest, "room id is required")
		return
	}

	roomState, found, err := app.store.GetRoom(r.Context(), roomID, true)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !found {
		writeJSONError(w, http.StatusNotFound, "room not found")
		return
	}

	writeJSONResponse(w, http.StatusOK, roomState)
}

func (app *App) handlePatchRoom(w http.ResponseWriter, r *http.Request) {
	roomID := strings.TrimSpace(r.PathValue("roomID"))
	if roomID == "" {
		writeJSONError(w, http.StatusBadRequest, "room id is required")
		return
	}

	bodyReader := io.LimitReader(r.Body, maxPatchBodySize)
	defer r.Body.Close()

	var patch map[string]json.RawMessage
	if err := json.NewDecoder(bodyReader).Decode(&patch); err != nil {
		writeJSONError(w, http.StatusBadRequest, "request body must be a JSON object")
		return
	}

	roomState, err := app.store.PatchRoom(r.Context(), roomID, patch)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	app.hub.Broadcast(roomID, roomState)
	writeJSONResponse(w, http.StatusOK, roomState)
}

func (app *App) handleRoomEvents(w http.ResponseWriter, r *http.Request) {
	roomID := strings.TrimSpace(r.PathValue("roomID"))
	if roomID == "" {
		writeJSONError(w, http.StatusBadRequest, "room id is required")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSONError(w, http.StatusInternalServerError, "streaming is not supported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	_, _ = io.WriteString(w, ": connected\n\n")
	flusher.Flush()

	initialRoomState, found, err := app.store.GetRoom(r.Context(), roomID, true)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	events, unsubscribe := app.hub.Subscribe(roomID)
	defer unsubscribe()

	if found {
		writeSSEMessage(w, flusher, initialRoomState)
	}

	keepAliveTicker := time.NewTicker(30 * time.Second)
	defer keepAliveTicker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case payload, ok := <-events:
			if !ok {
				return
			}
			writeSSEMessage(w, flusher, payload)
		case <-keepAliveTicker.C:
			_, _ = io.WriteString(w, ": keepalive\n\n")
			flusher.Flush()
		}
	}
}

func writeSSEMessage(w http.ResponseWriter, flusher http.Flusher, payload []byte) {
	_, _ = fmt.Fprintf(w, "data: %s\n\n", payload)
	flusher.Flush()
}

func writeJSONResponse(w http.ResponseWriter, status int, payload []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(payload)
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	responseBody, err := json.Marshal(map[string]string{
		"error": message,
	})
	if err != nil {
		http.Error(w, message, status)
		return
	}
	writeJSONResponse(w, status, responseBody)
}

func spaHandler(buildDir string) http.Handler {
	fileServer := http.FileServer(http.Dir(buildDir))
	indexPath := filepath.Join(buildDir, "index.html")

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.NotFound(w, r)
			return
		}

		cleanPath := pathFromRequest(r.URL.Path)
		if cleanPath == "" {
			http.ServeFile(w, r, indexPath)
			return
		}

		fullPath := filepath.Join(buildDir, cleanPath)
		if info, err := os.Stat(fullPath); err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}

		http.ServeFile(w, r, indexPath)
	})
}

func pathFromRequest(requestPath string) string {
	cleanedPath := filepath.Clean(strings.TrimPrefix(requestPath, "/"))
	if cleanedPath == "." || cleanedPath == "" {
		return ""
	}
	if cleanedPath == ".." || strings.HasPrefix(cleanedPath, ".."+string(filepath.Separator)) {
		return ""
	}
	return cleanedPath
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

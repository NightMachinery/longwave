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
	maxBodySize            = 1 << 20
	sessionCookieName      = "longwave_session"
)

type Config struct {
	Addr            string
	BuildDir        string
	DBPath          string
	RoomTTL         time.Duration
	CleanupInterval time.Duration
	Now             func() time.Time
}

type App struct {
	config      Config
	store       *Store
	hub         *RoomHub
	handler     http.Handler
	server      *http.Server
	cleanupStop chan struct{}
}

type joinRequest struct {
	PlayerName   string `json:"playerName"`
	MigrationKey string `json:"migrationKey"`
	DeckLanguage string `json:"deckLanguage"`
}

type migrateResponse struct {
	URL string `json:"url"`
}

type authenticatedRoomResult struct {
	room            RoomState
	playerID        string
	ok              bool
	canonicalRoomID string
	stale           bool
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
	app := &App{config: config, store: store, hub: NewRoomHub(), cleanupStop: make(chan struct{})}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", app.handleHealthz)
	mux.HandleFunc("POST /api/rooms/{roomID}/join", app.handleJoinRoom)
	mux.HandleFunc("POST /api/rooms/{roomID}/migrate", app.handleMigrateRoom)
	mux.HandleFunc("GET /api/rooms/{roomID}", app.handleGetRoom)
	mux.HandleFunc("POST /api/rooms/{roomID}/actions", app.handleRoomAction)
	mux.HandleFunc("GET /api/rooms/{roomID}/events", app.handleRoomEvents)
	mux.Handle("/", spaHandler(config.BuildDir))
	app.handler = mux
	app.server = &http.Server{Addr: config.Addr, Handler: mux}
	if err := app.store.DeleteExpired(context.Background()); err != nil {
		return nil, fmt.Errorf("cleanup expired rooms: %w", err)
	}
	go app.cleanupExpiredRooms()
	return app, nil
}

func (app *App) Handler() http.Handler { return app.handler }
func (app *App) ListenAndServe() error { return app.server.ListenAndServe() }

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

func (app *App) handleJoinRoom(w http.ResponseWriter, r *http.Request) {
	roomID := strings.TrimSpace(r.PathValue("roomID"))
	if roomID == "" {
		writeJSONError(w, http.StatusBadRequest, "room id is required")
		return
	}
	var request joinRequest
	if err := decodeJSONBody(r, &request); err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	sessionSecret := readSessionCookie(r)
	if requestedRoom, found, err := app.store.LoadRoom(r.Context(), roomID, false); err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	} else if found && requestedRoom.RedirectRoomID != "" {
		targetRoom, targetFound, err := app.store.LoadRoom(r.Context(), requestedRoom.RedirectRoomID, true)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if !targetFound {
			writeJSONErrorValue(w, http.StatusGone, map[string]string{
				"error": "room link is stale",
				"code":  "stale_room_link",
			})
			return
		}
		if playerID, ok := authenticatedPlayer(&targetRoom, sessionSecret); ok {
			updatedRoom, err := app.store.UpdateRoom(r.Context(), requestedRoom.RedirectRoomID, func(room *RoomState, _ bool) error {
				player := room.Players[playerID]
				if strings.TrimSpace(request.PlayerName) != "" {
					player.Name = strings.TrimSpace(request.PlayerName)
					room.Players[playerID] = player
				}
				return nil
			})
			if err != nil {
				writeJSONError(w, http.StatusInternalServerError, err.Error())
				return
			}
			setSessionCookie(w, updatedRoom.Players[playerID].SessionSecret)
			writeJSONResponseValue(w, http.StatusOK, sanitizeRoomForViewer(updatedRoom, requestedRoom.RedirectRoomID, playerID))
			return
		}
		writeJSONErrorValue(w, http.StatusGone, map[string]string{
			"error": "room link is stale",
			"code":  "stale_room_link",
		})
		return
	}
	joinedPlayerID := ""
	room, err := app.store.UpdateRoom(r.Context(), roomID, func(room *RoomState, found bool) error {
		if !found {
			*room = InitialRoomState(request.DeckLanguage)
		}
		if room.Players == nil {
			room.Players = map[string]PlayerState{}
		}
		if room.MigrationTokens == nil {
			room.MigrationTokens = map[string]string{}
		}
		if playerID, ok := authenticatedPlayer(room, sessionSecret); ok {
			joinedPlayerID = playerID
			player := room.Players[playerID]
			if strings.TrimSpace(request.PlayerName) != "" {
				player.Name = strings.TrimSpace(request.PlayerName)
				room.Players[playerID] = player
			}
			return nil
		}
		if request.MigrationKey != "" {
			if migratedPlayerID, ok := room.MigrationTokens[request.MigrationKey]; ok {
				joinedPlayerID = migratedPlayerID
				player := room.Players[migratedPlayerID]
				player.SessionSecret = randomToken(16)
				room.Players[migratedPlayerID] = player
				delete(room.MigrationTokens, request.MigrationKey)
				return nil
			}
		}
		joinedPlayerID = randomToken(8)
		playerName := strings.TrimSpace(request.PlayerName)
		if playerName == "" {
			playerName = "Player"
		}
		room.Players[joinedPlayerID] = PlayerState{
			Name:          playerName,
			Team:          TeamUnset,
			IsModerator:   room.CreatorID == "",
			SessionSecret: randomToken(16),
		}
		if room.CreatorID == "" {
			room.CreatorID = joinedPlayerID
		}
		return nil
	})
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	playerID := joinedPlayerID
	setSessionCookie(w, room.Players[playerID].SessionSecret)
	app.hub.Broadcast(roomID)
	writeJSONResponseValue(w, http.StatusOK, sanitizeRoomForViewer(room, roomID, playerID))
}

func (app *App) handleMigrateRoom(w http.ResponseWriter, r *http.Request) {
	roomID := strings.TrimSpace(r.PathValue("roomID"))
	result, err := app.authenticatedRoom(r.Context(), roomID, r)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if result.stale {
		writeJSONErrorValue(w, http.StatusGone, map[string]string{
			"error": "room link is stale",
			"code":  "stale_room_link",
		})
		return
	}
	if !result.ok {
		writeJSONError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	room, err := app.store.UpdateRoom(r.Context(), result.canonicalRoomID, func(current *RoomState, _ bool) error {
		token := randomToken(16)
		if current.MigrationTokens == nil {
			current.MigrationTokens = map[string]string{}
		}
		current.MigrationTokens[token] = result.playerID
		return nil
	})
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	var token string
	for migrationToken, migrationPlayerID := range room.MigrationTokens {
		if migrationPlayerID == result.playerID {
			token = migrationToken
		}
	}
	writeJSONResponseValue(w, http.StatusOK, migrateResponse{URL: buildMigrationURL(r, result.canonicalRoomID, token)})
}

func (app *App) handleGetRoom(w http.ResponseWriter, r *http.Request) {
	roomID := strings.TrimSpace(r.PathValue("roomID"))
	result, err := app.authenticatedRoom(r.Context(), roomID, r)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if result.stale {
		writeJSONErrorValue(w, http.StatusGone, map[string]string{
			"error": "room link is stale",
			"code":  "stale_room_link",
		})
		return
	}
	if !result.ok {
		writeJSONError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	writeJSONResponseValue(w, http.StatusOK, sanitizeRoomForViewer(result.room, result.canonicalRoomID, result.playerID))
}

func (app *App) handleRoomAction(w http.ResponseWriter, r *http.Request) {
	roomID := strings.TrimSpace(r.PathValue("roomID"))
	result, err := app.authenticatedRoom(r.Context(), roomID, r)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if result.stale {
		writeJSONErrorValue(w, http.StatusGone, map[string]string{
			"error": "room link is stale",
			"code":  "stale_room_link",
		})
		return
	}
	if !result.ok {
		writeJSONError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var action ActionRequest
	if err := decodeJSONBody(r, &action); err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	if action.Type == "reset_room_id" {
		newRoomID, updatedRoom, err := app.store.ResetRoomID(r.Context(), result.canonicalRoomID, func(room *RoomState) error {
			player, ok := room.Players[result.playerID]
			if !ok {
				return errUnauthorized
			}
			if !player.IsModerator {
				return errUnauthorized
			}
			return nil
		})
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, errUnauthorized) {
				status = http.StatusForbidden
			}
			writeJSONError(w, status, err.Error())
			return
		}
		app.hub.Broadcast(result.canonicalRoomID)
		app.hub.Broadcast(newRoomID)
		writeJSONResponseValue(w, http.StatusOK, sanitizeRoomForViewer(updatedRoom, newRoomID, result.playerID))
		return
	}
	updatedRoom, err := app.store.UpdateRoom(r.Context(), result.canonicalRoomID, func(room *RoomState, _ bool) error {
		if _, ok := room.Players[result.playerID]; !ok {
			return errUnauthorized
		}
		if err := applyAction(room, result.playerID, action); err != nil {
			return err
		}
		normalizeRoundState(room)
		return nil
	})
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, errUnauthorized) {
			status = http.StatusForbidden
		} else if strings.Contains(err.Error(), "required") ||
			strings.Contains(err.Error(), "cannot") ||
			strings.Contains(err.Error(), "unsupported") ||
			strings.Contains(err.Error(), "only") ||
			strings.Contains(err.Error(), "not found") ||
			strings.Contains(err.Error(), "must be") ||
			strings.Contains(err.Error(), "reached") ||
			strings.Contains(err.Error(), "closed") ||
			strings.Contains(err.Error(), "available") ||
			strings.Contains(err.Error(), "join a team") {
			status = http.StatusBadRequest
		}
		writeJSONError(w, status, err.Error())
		return
	}
	app.hub.Broadcast(result.canonicalRoomID)
	writeJSONResponseValue(w, http.StatusOK, sanitizeRoomForViewer(updatedRoom, result.canonicalRoomID, result.playerID))
}

func (app *App) handleRoomEvents(w http.ResponseWriter, r *http.Request) {
	roomID := strings.TrimSpace(r.PathValue("roomID"))
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSONError(w, http.StatusInternalServerError, "streaming is not supported")
		return
	}
	result, err := app.authenticatedRoom(r.Context(), roomID, r)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if result.stale {
		writeJSONErrorValue(w, http.StatusGone, map[string]string{
			"error": "room link is stale",
			"code":  "stale_room_link",
		})
		return
	}
	if !result.ok {
		writeJSONError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	_, _ = io.WriteString(w, ": connected\n\n")
	flusher.Flush()
	events, unsubscribe := app.hub.Subscribe(roomID)
	defer unsubscribe()
	if nextResult, err := app.authenticatedRoom(r.Context(), roomID, r); err == nil && nextResult.ok {
		writeSSEMessageValue(w, flusher, sanitizeRoomForViewer(nextResult.room, nextResult.canonicalRoomID, nextResult.playerID))
	}
	keepAliveTicker := time.NewTicker(30 * time.Second)
	defer keepAliveTicker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case _, ok := <-events:
			if !ok {
				return
			}
			nextResult, err := app.authenticatedRoom(r.Context(), roomID, r)
			if err != nil || !nextResult.ok {
				return
			}
			writeSSEMessageValue(w, flusher, sanitizeRoomForViewer(nextResult.room, nextResult.canonicalRoomID, nextResult.playerID))
		case <-keepAliveTicker.C:
			_, _ = io.WriteString(w, ": keepalive\n\n")
			flusher.Flush()
		}
	}
}

func (app *App) authenticatedRoom(ctx context.Context, roomID string, r *http.Request) (authenticatedRoomResult, error) {
	room, found, err := app.store.LoadRoom(ctx, roomID, true)
	if err != nil {
		return authenticatedRoomResult{}, err
	}
	if !found {
		return authenticatedRoomResult{}, nil
	}
	if room.RedirectRoomID != "" {
		redirectedRoom, redirectedFound, err := app.store.LoadRoom(ctx, room.RedirectRoomID, true)
		if err != nil {
			return authenticatedRoomResult{}, err
		}
		if !redirectedFound {
			return authenticatedRoomResult{stale: true, canonicalRoomID: room.RedirectRoomID}, nil
		}
		playerID, ok := authenticatedPlayer(&redirectedRoom, readSessionCookie(r))
		if !ok {
			return authenticatedRoomResult{stale: true, canonicalRoomID: room.RedirectRoomID}, nil
		}
		return authenticatedRoomResult{
			room:            redirectedRoom,
			playerID:        playerID,
			ok:              true,
			canonicalRoomID: room.RedirectRoomID,
		}, nil
	}
	playerID, ok := authenticatedPlayer(&room, readSessionCookie(r))
	return authenticatedRoomResult{
		room:            room,
		playerID:        playerID,
		ok:              ok,
		canonicalRoomID: roomID,
	}, nil
}

func authenticatedPlayer(room *RoomState, sessionSecret string) (string, bool) {
	if sessionSecret == "" {
		return "", false
	}
	for playerID, player := range room.Players {
		if player.SessionSecret == sessionSecret {
			return playerID, true
		}
	}
	return "", false
}

func readSessionCookie(r *http.Request) string {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(cookie.Value)
}

func setSessionCookie(w http.ResponseWriter, sessionSecret string) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    sessionSecret,
		HttpOnly: true,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
	})
}

func decodeJSONBody(r *http.Request, target any) error {
	bodyReader := io.LimitReader(r.Body, maxBodySize)
	defer r.Body.Close()
	if err := json.NewDecoder(bodyReader).Decode(target); err != nil {
		return fmt.Errorf("request body must be valid JSON")
	}
	return nil
}

func writeSSEMessageValue(w http.ResponseWriter, flusher http.Flusher, payload any) {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return
	}
	_, _ = fmt.Fprintf(w, "data: %s\n\n", encoded)
	flusher.Flush()
}

func writeJSONResponseValue(w http.ResponseWriter, status int, payload any) {
	encoded, err := json.Marshal(payload)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSONResponse(w, status, encoded)
}

func writeJSONResponse(w http.ResponseWriter, status int, payload []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(payload)
}

func writeJSONErrorValue(w http.ResponseWriter, status int, payload map[string]string) {
	responseBody, err := json.Marshal(payload)
	if err != nil {
		http.Error(w, payload["error"], status)
		return
	}
	writeJSONResponse(w, status, responseBody)
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	writeJSONErrorValue(w, status, map[string]string{"error": message})
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

func buildMigrationURL(r *http.Request, roomID string, token string) string {
	scheme := "http"
	if forwardedProto := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")); forwardedProto != "" {
		scheme = forwardedProto
	} else if r.TLS != nil {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s/%s?migrate=%s", scheme, r.Host, roomID, token)
}

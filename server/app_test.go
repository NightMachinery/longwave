package server

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRoomJoinActionFilteringAndEventStream(t *testing.T) {
	t.Parallel()

	testServer := newTestHTTPServer(t)
	defer testServer.Close()

	aliceJoin := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/join", map[string]any{
		"playerName": "Alice",
	})
	if aliceJoin.StatusCode != http.StatusOK {
		t.Fatalf("expected join to return 200, got %d", aliceJoin.StatusCode)
	}
	aliceCookie := aliceJoin.Cookies()[0]
	aliceBody := decodeBody[RoomView](t, aliceJoin.Body)
	if aliceBody.CreatorID == "" || !aliceBody.Players[aliceBody.Viewer.PlayerID].IsModerator {
		t.Fatalf("expected first joiner to become creator moderator, got %#v", aliceBody)
	}
	if aliceBody.Viewer.PlayerID == "" {
		t.Fatalf("expected join response to include viewer player id")
	}

	cooperative := int(GameTypeCooperative)
	actionResponse := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":     "set_game_type",
		"gameType": cooperative,
	}, aliceCookie)
	if actionResponse.StatusCode != http.StatusOK {
		t.Fatalf("expected action to return 200, got %d", actionResponse.StatusCode)
	}
	aliceActionBody := decodeBody[RoomView](t, actionResponse.Body)
	if aliceActionBody.RoundPhase != RoundPhaseGiveClue {
		t.Fatalf("expected cooperative mode to start clueing, got %v", aliceActionBody.RoundPhase)
	}
	if !aliceActionBody.Viewer.IsCurrentPsychic {
		t.Fatalf("expected acting player to be marked as the current psychic")
	}

	bobJoin := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/join", map[string]any{
		"playerName": "Bob",
	})
	if bobJoin.StatusCode != http.StatusOK {
		t.Fatalf("expected bob join to return 200, got %d", bobJoin.StatusCode)
	}
	bobCookie := bobJoin.Cookies()[0]
	bobGet := doRequestWithCookie(t, testServer, http.MethodGet, "/api/rooms/ROOM", nil, bobCookie)
	if bobGet.StatusCode != http.StatusOK {
		t.Fatalf("expected bob get to return 200, got %d", bobGet.StatusCode)
	}
	bobBody := decodeBody[RoomView](t, bobGet.Body)
	if bobBody.SpectrumTarget != 0 {
		t.Fatalf("expected non-psychic room view to hide target, got %d", bobBody.SpectrumTarget)
	}

	streamResponse := doRequestWithCookie(t, testServer, http.MethodGet, "/api/rooms/ROOM/events", nil, bobCookie)
	if streamResponse.StatusCode != http.StatusOK {
		t.Fatalf("expected room events to return 200, got %d", streamResponse.StatusCode)
	}
	defer streamResponse.Body.Close()

	streamReader := bufio.NewReader(streamResponse.Body)
	streamPayload := make(chan string, 1)
	streamError := make(chan error, 1)

	go func() {
		for {
			line, err := streamReader.ReadString('\n')
			if err != nil {
				streamError <- err
				return
			}
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			payload := strings.TrimSpace(strings.TrimPrefix(line, "data: "))
			if strings.Contains(payload, `"text":"coffee"`) {
				streamPayload <- payload
				return
			}
		}
	}()

	clueAction := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type": "submit_clue",
		"clue": "coffee",
	}, aliceCookie)
	if clueAction.StatusCode != http.StatusOK {
		t.Fatalf("expected submit clue to return 200, got %d", clueAction.StatusCode)
	}

	select {
	case payload := <-streamPayload:
		if !strings.Contains(payload, `"clues":[{"authorId"`) {
			t.Fatalf("expected event stream payload to include clue update, got %s", payload)
		}
		if strings.Contains(payload, `"spectrumTarget":`) && !strings.Contains(payload, `"spectrumTarget":0`) {
			t.Fatalf("expected bob SSE payload to keep hidden target filtered, got %s", payload)
		}
	case err := <-streamError:
		t.Fatalf("read event stream payload: %v", err)
	case <-time.After(5 * time.Second):
		t.Fatalf("timed out waiting for event stream payload")
	}
}

func TestStaticFilesServeAssetsAndFallbackToIndex(t *testing.T) {
	t.Parallel()

	testServer := newTestHTTPServer(t)
	defer testServer.Close()

	assetResponse, err := testServer.Client().Get(testServer.URL + "/main.js")
	if err != nil {
		t.Fatalf("get bundled asset: %v", err)
	}
	defer assetResponse.Body.Close()

	assetBody, err := io.ReadAll(assetResponse.Body)
	if err != nil {
		t.Fatalf("read bundled asset: %v", err)
	}
	if string(assetBody) != "console.log('longwave');" {
		t.Fatalf("unexpected asset response body: %q", assetBody)
	}

	spaResponse, err := testServer.Client().Get(testServer.URL + "/room/ABCD")
	if err != nil {
		t.Fatalf("get SPA route: %v", err)
	}
	defer spaResponse.Body.Close()

	spaBody, err := io.ReadAll(spaResponse.Body)
	if err != nil {
		t.Fatalf("read SPA response body: %v", err)
	}
	if !strings.Contains(string(spaBody), "<div id=\"root\"></div>") {
		t.Fatalf("expected SPA fallback to return index.html, got %s", spaBody)
	}
}

func newTestHTTPServer(t *testing.T) *httptest.Server {
	t.Helper()

	buildDir := t.TempDir()
	if err := osWriteFile(filepath.Join(buildDir, "index.html"), []byte("<!doctype html><html><body><div id=\"root\"></div></body></html>")); err != nil {
		t.Fatalf("write index.html: %v", err)
	}
	if err := osWriteFile(filepath.Join(buildDir, "main.js"), []byte("console.log('longwave');")); err != nil {
		t.Fatalf("write main.js: %v", err)
	}

	now := time.Date(2026, 4, 15, 12, 0, 0, 0, time.UTC)
	app, err := New(Config{
		BuildDir:        buildDir,
		DBPath:          filepath.Join(t.TempDir(), "rooms.sqlite"),
		RoomTTL:         7 * 24 * time.Hour,
		CleanupInterval: time.Hour,
		Now: func() time.Time {
			return now
		},
	})
	if err != nil {
		t.Fatalf("create test app: %v", err)
	}

	t.Cleanup(func() {
		if err := app.Close(); err != nil {
			t.Fatalf("close test app: %v", err)
		}
	})

	return httptest.NewServer(app.Handler())
}

func doJSONRequest(t *testing.T, server *httptest.Server, method string, path string, body map[string]any, cookies ...*http.Cookie) *http.Response {
	t.Helper()
	encodedBody, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("encode json request: %v", err)
	}
	return doRequestWithCookie(t, server, method, path, encodedBody, cookies...)
}

func doRequestWithCookie(t *testing.T, server *httptest.Server, method string, path string, body []byte, cookies ...*http.Cookie) *http.Response {
	t.Helper()
	request, err := http.NewRequestWithContext(context.Background(), method, server.URL+path, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("create request: %v", err)
	}
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}
	response, err := server.Client().Do(request)
	if err != nil {
		t.Fatalf("execute request: %v", err)
	}
	return response
}

func decodeBody[T any](t *testing.T, body io.ReadCloser) T {
	t.Helper()
	defer body.Close()
	payload, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	var decoded T
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatalf("decode body: %v\npayload: %s", err, payload)
	}
	return decoded
}

func osWriteFile(path string, data []byte) error {
	return os.WriteFile(path, data, 0o644)
}

func TestOnlyModeratorsCanStartTeamGameAndAssignTeams(t *testing.T) {
	t.Parallel()

	testServer := newTestHTTPServer(t)
	defer testServer.Close()

	aliceJoin := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/join", map[string]any{
		"playerName": "Alice",
	})
	if aliceJoin.StatusCode != http.StatusOK {
		t.Fatalf("expected alice join to return 200, got %d", aliceJoin.StatusCode)
	}
	aliceCookie := aliceJoin.Cookies()[0]
	_ = decodeBody[RoomView](t, aliceJoin.Body)

	bobJoin := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/join", map[string]any{
		"playerName": "Bob",
	})
	if bobJoin.StatusCode != http.StatusOK {
		t.Fatalf("expected bob join to return 200, got %d", bobJoin.StatusCode)
	}
	bobCookie := bobJoin.Cookies()[0]
	bobBody := decodeBody[RoomView](t, bobJoin.Body)

	aliceJoinTeam := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type": "join_team",
		"team": int(TeamLeft),
	}, aliceCookie)
	if aliceJoinTeam.StatusCode != http.StatusOK {
		t.Fatalf("expected alice team join to return 200, got %d", aliceJoinTeam.StatusCode)
	}

	bobJoinTeam := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type": "join_team",
		"team": int(TeamRight),
	}, bobCookie)
	if bobJoinTeam.StatusCode != http.StatusOK {
		t.Fatalf("expected bob team join to return 200, got %d", bobJoinTeam.StatusCode)
	}

	setTeamsMode := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":     "set_game_type",
		"gameType": int(GameTypeTeams),
	}, aliceCookie)
	if setTeamsMode.StatusCode != http.StatusOK {
		t.Fatalf("expected moderator set_game_type to return 200, got %d", setTeamsMode.StatusCode)
	}

	bobStart := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type": "start_round",
	}, bobCookie)
	if bobStart.StatusCode != http.StatusForbidden {
		t.Fatalf("expected non-moderator start_round to return 403, got %d", bobStart.StatusCode)
	}

	assignBob := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":     "set_team",
		"playerId": bobBody.Viewer.PlayerID,
		"team":     int(TeamLeft),
	}, aliceCookie)
	if assignBob.StatusCode != http.StatusOK {
		t.Fatalf("expected moderator set_team to return 200, got %d", assignBob.StatusCode)
	}
	assignBody := decodeBody[RoomView](t, assignBob.Body)
	if assignBody.Players[bobBody.Viewer.PlayerID].Team != TeamLeft {
		t.Fatalf("expected bob to be force-assigned to left team, got %v", assignBody.Players[bobBody.Viewer.PlayerID].Team)
	}

	aliceStart := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type": "start_round",
	}, aliceCookie)
	if aliceStart.StatusCode != http.StatusOK {
		t.Fatalf("expected moderator start_round to return 200, got %d", aliceStart.StatusCode)
	}
	startedBody := decodeBody[RoomView](t, aliceStart.Body)
	if startedBody.RoundPhase != RoundPhaseGiveClue {
		t.Fatalf("expected started game to enter clue phase, got %v", startedBody.RoundPhase)
	}
	if startedBody.ActingTeam != TeamLeft {
		t.Fatalf("expected acting team to match moderator starter team, got %v", startedBody.ActingTeam)
	}
}

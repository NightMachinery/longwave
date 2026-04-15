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

func TestRoomAPIAndEventStream(t *testing.T) {
	t.Parallel()

	testServer := newTestHTTPServer(t)
	defer testServer.Close()

	response, err := testServer.Client().Get(testServer.URL + "/api/rooms/ROOM")
	if err != nil {
		t.Fatalf("get missing room: %v", err)
	}
	if response.StatusCode != http.StatusNotFound {
		t.Fatalf("expected missing room to return 404, got %d", response.StatusCode)
	}
	_ = response.Body.Close()

	streamResponse, err := testServer.Client().Get(testServer.URL + "/api/rooms/ROOM/events")
	if err != nil {
		t.Fatalf("connect event stream: %v", err)
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

			streamPayload <- strings.TrimSpace(strings.TrimPrefix(line, "data: "))
			return
		}
	}()

	roomPatch, err := json.Marshal(map[string]any{
		"guess": 9,
		"players": map[string]any{
			"p1": map[string]any{
				"name": "Alice",
			},
		},
	})
	if err != nil {
		t.Fatalf("encode room patch: %v", err)
	}

	patchResponse, err := testServer.Client().Do(newJSONRequest(t, http.MethodPatch, testServer.URL+"/api/rooms/ROOM", roomPatch))
	if err != nil {
		t.Fatalf("patch room: %v", err)
	}
	defer patchResponse.Body.Close()

	if patchResponse.StatusCode != http.StatusOK {
		t.Fatalf("expected patch to return 200, got %d", patchResponse.StatusCode)
	}

	select {
	case payload := <-streamPayload:
		if !strings.Contains(payload, `"guess":9`) {
			t.Fatalf("expected event stream payload to include updated room state, got %s", payload)
		}
	case err := <-streamError:
		t.Fatalf("read event stream payload: %v", err)
	case <-time.After(5 * time.Second):
		t.Fatalf("timed out waiting for event stream payload")
	}

	getResponse, err := testServer.Client().Get(testServer.URL + "/api/rooms/ROOM")
	if err != nil {
		t.Fatalf("get saved room: %v", err)
	}
	defer getResponse.Body.Close()

	if getResponse.StatusCode != http.StatusOK {
		t.Fatalf("expected saved room to return 200, got %d", getResponse.StatusCode)
	}

	savedRoomState, err := io.ReadAll(getResponse.Body)
	if err != nil {
		t.Fatalf("read saved room: %v", err)
	}
	if !bytes.Contains(savedRoomState, []byte(`"guess":9`)) {
		t.Fatalf("expected saved room to include guess 9, got %s", savedRoomState)
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

func newJSONRequest(t *testing.T, method string, url string, body []byte) *http.Request {
	t.Helper()

	request, err := http.NewRequestWithContext(context.Background(), method, url, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("create %s request: %v", method, err)
	}
	request.Header.Set("Content-Type", "application/json")

	return request
}

func osWriteFile(path string, data []byte) error {
	return os.WriteFile(path, data, 0o644)
}

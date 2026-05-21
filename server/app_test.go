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

func TestModeratorCanSetWordpackDuringSetupAndMidGame(t *testing.T) {
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
	if aliceBody.Wordpack != defaultWordpack {
		t.Fatalf("expected new room to default to English wordpack, got %q", aliceBody.Wordpack)
	}

	bobJoin := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/join", map[string]any{
		"playerName": "Bob",
	})
	if bobJoin.StatusCode != http.StatusOK {
		t.Fatalf("expected bob join to return 200, got %d", bobJoin.StatusCode)
	}
	bobCookie := bobJoin.Cookies()[0]

	bobSet := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":     "set_wordpack",
		"wordpack": "Persian",
	}, bobCookie)
	if bobSet.StatusCode != http.StatusForbidden {
		t.Fatalf("expected non-moderator set_wordpack to return 403, got %d", bobSet.StatusCode)
	}

	setPersian := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":     "set_wordpack",
		"wordpack": "Persian",
	}, aliceCookie)
	if setPersian.StatusCode != http.StatusOK {
		t.Fatalf("expected moderator set_wordpack to return 200, got %d", setPersian.StatusCode)
	}
	setPersianBody := decodeBody[RoomView](t, setPersian.Body)
	if setPersianBody.Wordpack != "Persian" {
		t.Fatalf("expected Persian wordpack, got %q", setPersianBody.Wordpack)
	}
	if strings.Join(setPersianBody.Wordpacks, ",") != "Persian" {
		t.Fatalf("expected legacy set_wordpack to update wordpacks, got %v", setPersianBody.Wordpacks)
	}

	setMultiple := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":      "set_wordpacks",
		"wordpacks": []string{"Persian", "English"},
	}, aliceCookie)
	if setMultiple.StatusCode != http.StatusOK {
		t.Fatalf("expected moderator set_wordpacks to return 200, got %d", setMultiple.StatusCode)
	}
	setMultipleBody := decodeBody[RoomView](t, setMultiple.Body)
	if strings.Join(setMultipleBody.Wordpacks, ",") != "Persian,English" || setMultipleBody.Wordpack != "Persian" {
		t.Fatalf("expected multiple wordpacks with legacy first value preserved, got wordpack=%q wordpacks=%v", setMultipleBody.Wordpack, setMultipleBody.Wordpacks)
	}

	invalid := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":      "set_wordpacks",
		"wordpacks": []string{"English", "Missing"},
	}, aliceCookie)
	if invalid.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected invalid wordpack to return 400, got %d", invalid.StatusCode)
	}

	cooperative := int(GameTypeCooperative)
	start := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":     "set_game_type",
		"gameType": cooperative,
	}, aliceCookie)
	if start.StatusCode != http.StatusOK {
		t.Fatalf("expected set_game_type to return 200, got %d", start.StatusCode)
	}

	lateSet := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":     "set_wordpack",
		"wordpack": "English",
	}, aliceCookie)
	if lateSet.StatusCode != http.StatusOK {
		t.Fatalf("expected mid-game moderator set_wordpack to return 200, got %d", lateSet.StatusCode)
	}
	lateSetBody := decodeBody[RoomView](t, lateSet.Body)
	if lateSetBody.Wordpack != "English" {
		t.Fatalf("expected mid-game wordpack change to English, got %q", lateSetBody.Wordpack)
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

func TestCreatorCanSelfManageRepresentativeAndObserverButNotDemoteModerator(t *testing.T) {
	t.Parallel()

	testServer := newTestHTTPServer(t)
	defer testServer.Close()

	join := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/join", map[string]any{
		"playerName": "Alice",
	})
	if join.StatusCode != http.StatusOK {
		t.Fatalf("expected join to return 200, got %d", join.StatusCode)
	}
	creatorCookie := join.Cookies()[0]
	creatorBody := decodeBody[RoomView](t, join.Body)
	creatorID := creatorBody.Viewer.PlayerID

	setRep := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":     "set_representative",
		"playerId": creatorID,
		"value":    true,
	}, creatorCookie)
	if setRep.StatusCode != http.StatusOK {
		t.Fatalf("expected self representative update to return 200, got %d", setRep.StatusCode)
	}
	repBody := decodeBody[RoomView](t, setRep.Body)
	if !repBody.Players[creatorID].IsRepresentative {
		t.Fatalf("expected creator to become representative")
	}

	setObserver := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":     "set_observer",
		"playerId": creatorID,
		"value":    true,
	}, creatorCookie)
	if setObserver.StatusCode != http.StatusOK {
		t.Fatalf("expected self observer update to return 200, got %d", setObserver.StatusCode)
	}
	observerBody := decodeBody[RoomView](t, setObserver.Body)
	if !observerBody.Players[creatorID].IsObserver {
		t.Fatalf("expected creator to become observer")
	}

	demote := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":     "set_moderator",
		"playerId": creatorID,
		"value":    false,
	}, creatorCookie)
	if demote.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected demoting creator to fail with 400, got %d", demote.StatusCode)
	}
}

func TestObserverCanRejoinThemself(t *testing.T) {
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

	bobJoin := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/join", map[string]any{
		"playerName": "Bob",
	})
	if bobJoin.StatusCode != http.StatusOK {
		t.Fatalf("expected bob join to return 200, got %d", bobJoin.StatusCode)
	}
	bobCookie := bobJoin.Cookies()[0]
	bobBody := decodeBody[RoomView](t, bobJoin.Body)

	setObserver := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":     "set_observer",
		"playerId": bobBody.Viewer.PlayerID,
		"value":    true,
	}, aliceCookie)
	if setObserver.StatusCode != http.StatusOK {
		t.Fatalf("expected moderator observer update to return 200, got %d", setObserver.StatusCode)
	}

	rejoin := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":     "set_observer",
		"playerId": bobBody.Viewer.PlayerID,
		"value":    false,
	}, bobCookie)
	if rejoin.StatusCode != http.StatusOK {
		t.Fatalf("expected observer self-rejoin to return 200, got %d", rejoin.StatusCode)
	}
	rejoinBody := decodeBody[RoomView](t, rejoin.Body)
	if rejoinBody.Players[bobBody.Viewer.PlayerID].IsObserver {
		t.Fatalf("expected bob to rejoin active players")
	}

	aliceBody := decodeBody[RoomView](t, aliceJoin.Body)
	bobSetAliceObserver := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":     "set_observer",
		"playerId": aliceBody.Viewer.PlayerID,
		"value":    true,
	}, bobCookie)
	if bobSetAliceObserver.StatusCode != http.StatusForbidden {
		t.Fatalf("expected non-moderator observer update for another player to return 403, got %d", bobSetAliceObserver.StatusCode)
	}
}

func TestPlayAgainPreservesModeSettingsAndPlayers(t *testing.T) {
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
	aliceBody := decodeBody[RoomView](t, aliceJoin.Body)

	bobJoin := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/join", map[string]any{
		"playerName": "Bob",
	})
	if bobJoin.StatusCode != http.StatusOK {
		t.Fatalf("expected bob join to return 200, got %d", bobJoin.StatusCode)
	}
	_ = decodeBody[RoomView](t, bobJoin.Body)

	setPsychics := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":         "set_psychic_count",
		"psychicCount": 2,
	}, aliceCookie)
	if setPsychics.StatusCode != http.StatusOK {
		t.Fatalf("expected set psychics to return 200, got %d", setPsychics.StatusCode)
	}

	setClueQuota := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":      "set_clue_quota",
		"clueQuota": 2,
	}, aliceCookie)
	if setClueQuota.StatusCode != http.StatusOK {
		t.Fatalf("expected set clue quota to return 200, got %d", setClueQuota.StatusCode)
	}

	setGameType := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":     "set_game_type",
		"gameType": int(GameTypeCooperative),
	}, aliceCookie)
	if setGameType.StatusCode != http.StatusOK {
		t.Fatalf("expected coop start to return 200, got %d", setGameType.StatusCode)
	}

	playAgain := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type": "play_again",
	}, aliceCookie)
	if playAgain.StatusCode != http.StatusOK {
		t.Fatalf("expected play again to return 200, got %d", playAgain.StatusCode)
	}
	playAgainBody := decodeBody[RoomView](t, playAgain.Body)
	if playAgainBody.RoomID != "ROOM" {
		t.Fatalf("expected play again to preserve room id, got %q", playAgainBody.RoomID)
	}
	if playAgainBody.RoundPhase != RoundPhaseReady {
		t.Fatalf("expected cooperative play again to land in ready lobby, got %v", playAgainBody.RoundPhase)
	}
	if playAgainBody.GameType != GameTypeCooperative {
		t.Fatalf("expected cooperative mode to persist, got %v", playAgainBody.GameType)
	}
	if playAgainBody.CreatorID != aliceBody.Viewer.PlayerID {
		t.Fatalf("expected creator id to persist, got %q", playAgainBody.CreatorID)
	}
	if playAgainBody.PsychicCount != 2 || playAgainBody.ClueQuota != 2 {
		t.Fatalf("expected room settings to persist, got psychicCount=%d clueQuota=%d", playAgainBody.PsychicCount, playAgainBody.ClueQuota)
	}
	if len(playAgainBody.Players) != 2 {
		t.Fatalf("expected both players to remain in room, got %d", len(playAgainBody.Players))
	}
	if playAgainBody.TurnsTaken != -1 || len(playAgainBody.PsychicIDs) != 0 || len(playAgainBody.Clues) != 0 {
		t.Fatalf("expected round progress to reset, got turns=%d psychics=%d clues=%d", playAgainBody.TurnsTaken, len(playAgainBody.PsychicIDs), len(playAgainBody.Clues))
	}
}

func TestResetRoomIDInvalidatesOldJoinLinkButForwardsAuthenticatedPlayers(t *testing.T) {
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

	resetID := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type": "reset_room_id",
	}, aliceCookie)
	if resetID.StatusCode != http.StatusOK {
		t.Fatalf("expected reset room id to return 200, got %d", resetID.StatusCode)
	}
	resetBody := decodeBody[RoomView](t, resetID.Body)
	if resetBody.RoomID == "" || resetBody.RoomID == "ROOM" {
		t.Fatalf("expected a new canonical room id, got %q", resetBody.RoomID)
	}

	bobJoinOld := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/join", map[string]any{
		"playerName": "Bob",
	})
	if bobJoinOld.StatusCode != http.StatusGone {
		t.Fatalf("expected old room id join to fail with 410, got %d", bobJoinOld.StatusCode)
	}

	aliceOldGet := doRequestWithCookie(t, testServer, http.MethodGet, "/api/rooms/ROOM", nil, aliceCookie)
	if aliceOldGet.StatusCode != http.StatusOK {
		t.Fatalf("expected authenticated old room get to forward with 200, got %d", aliceOldGet.StatusCode)
	}
	aliceForwarded := decodeBody[RoomView](t, aliceOldGet.Body)
	if aliceForwarded.RoomID != resetBody.RoomID {
		t.Fatalf("expected authenticated old room get to resolve to %q, got %q", resetBody.RoomID, aliceForwarded.RoomID)
	}

	aliceRenameOldPath := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type": "set_name",
		"name": "Alice Again",
	}, aliceCookie)
	if aliceRenameOldPath.StatusCode != http.StatusOK {
		t.Fatalf("expected authenticated action on old path to forward with 200, got %d", aliceRenameOldPath.StatusCode)
	}
	renameBody := decodeBody[RoomView](t, aliceRenameOldPath.Body)
	if renameBody.RoomID != resetBody.RoomID {
		t.Fatalf("expected forwarded action response to use new room id, got %q", renameBody.RoomID)
	}
}

func TestRerollRoundKeepsPsychicsAndOnlyWorksBeforeFirstClue(t *testing.T) {
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
	aliceBody := decodeBody[RoomView](t, aliceJoin.Body)

	bobJoin := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/join", map[string]any{
		"playerName": "Bob",
	})
	if bobJoin.StatusCode != http.StatusOK {
		t.Fatalf("expected bob join to return 200, got %d", bobJoin.StatusCode)
	}
	bobCookie := bobJoin.Cookies()[0]
	bobBody := decodeBody[RoomView](t, bobJoin.Body)

	setGameType := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type":     "set_game_type",
		"gameType": int(GameTypeCooperative),
	}, aliceCookie)
	if setGameType.StatusCode != http.StatusOK {
		t.Fatalf("expected coop start to return 200, got %d", setGameType.StatusCode)
	}
	startedBody := decodeBody[RoomView](t, setGameType.Body)
	initialDeckIndex := startedBody.DeckIndex
	initialPsychics := append([]string(nil), startedBody.PsychicIDs...)
	if len(initialPsychics) != 1 {
		t.Fatalf("expected one psychic in default coop mode, got %d", len(initialPsychics))
	}

	reroll := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type": "reroll_round",
	}, aliceCookie)
	if reroll.StatusCode != http.StatusOK {
		t.Fatalf("expected reroll to return 200, got %d", reroll.StatusCode)
	}
	rerolledBody := decodeBody[RoomView](t, reroll.Body)
	if rerolledBody.DeckIndex != initialDeckIndex+1 {
		t.Fatalf("expected reroll to advance deck index to %d, got %d", initialDeckIndex+1, rerolledBody.DeckIndex)
	}
	if strings.Join(rerolledBody.PsychicIDs, ",") != strings.Join(initialPsychics, ",") {
		t.Fatalf("expected reroll to keep psychics %v, got %v", initialPsychics, rerolledBody.PsychicIDs)
	}

	psychicCookie := aliceCookie
	psychicID := initialPsychics[0]
	if psychicID == bobBody.Viewer.PlayerID {
		psychicCookie = bobCookie
	} else if psychicID != aliceBody.Viewer.PlayerID {
		t.Fatalf("unexpected psychic id %q", psychicID)
	}

	submitClue := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type": "submit_clue",
		"clue": "coffee",
	}, psychicCookie)
	if submitClue.StatusCode != http.StatusOK {
		t.Fatalf("expected clue submission to return 200, got %d", submitClue.StatusCode)
	}

	rerollAfterClue := doJSONRequest(t, testServer, http.MethodPost, "/api/rooms/ROOM/actions", map[string]any{
		"type": "reroll_round",
	}, aliceCookie)
	if rerollAfterClue.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected reroll after a clue to fail with 400, got %d", rerollAfterClue.StatusCode)
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
	aliceBody := decodeBody[RoomView](t, aliceJoin.Body)

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
	if startedBody.ActingTeam != startedBody.Players[aliceBody.Viewer.PlayerID].Team {
		t.Fatalf("expected acting team to match moderator starter team, got %v", startedBody.ActingTeam)
	}
}

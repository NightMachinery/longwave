package server

import (
	"crypto/rand"
	"encoding/hex"
	mathrand "math/rand"
	"sort"
	"strings"
	"time"
)

type RoundPhase int

type GameType int

type Team int

const (
	RoundPhaseSetupGame RoundPhase = iota
	RoundPhasePickTeams
	RoundPhaseGiveClue
	RoundPhaseMakeGuess
	RoundPhaseCounterGuess
	RoundPhaseViewScore
)

const (
	GameTypeTeams GameType = iota
	GameTypeCooperative
	GameTypeFreeplay
)

const (
	TeamUnset Team = iota
	TeamLeft
	TeamRight
)

type PlayerState struct {
	Name             string `json:"name"`
	Team             Team   `json:"team"`
	IsModerator      bool   `json:"isModerator"`
	IsRepresentative bool   `json:"isRepresentative"`
	IsObserver       bool   `json:"isObserver"`
	SessionSecret    string `json:"sessionSecret,omitempty"`
}

type Clue struct {
	AuthorID   string `json:"authorId"`
	AuthorName string `json:"authorName"`
	Text       string `json:"text"`
	Order      int    `json:"order"`
}

type TurnSummaryModel struct {
	DeckIndex      int    `json:"deckIndex"`
	ClueAuthorName string `json:"clueAuthorName"`
	Clues          []Clue `json:"clues"`
	SpectrumTarget int    `json:"spectrumTarget"`
	Guess          int    `json:"guess"`
}

type RoomState struct {
	GameType        GameType                    `json:"gameType"`
	RoundPhase      RoundPhase                  `json:"roundPhase"`
	TurnsTaken      int                         `json:"turnsTaken"`
	DeckSeed        string                      `json:"deckSeed"`
	DeckIndex       int                         `json:"deckIndex"`
	SpectrumTarget  int                         `json:"spectrumTarget"`
	Clues           []Clue                      `json:"clues"`
	Guess           int                         `json:"guess"`
	CounterGuess    string                      `json:"counterGuess"`
	Players         map[string]PlayerState      `json:"players"`
	PsychicIDs      []string                    `json:"psychicIds"`
	ActingTeam      Team                        `json:"actingTeam"`
	LeftScore       int                         `json:"leftScore"`
	RightScore      int                         `json:"rightScore"`
	CoopScore       int                         `json:"coopScore"`
	CoopBonusTurns  int                         `json:"coopBonusTurns"`
	PreviousTurn    *TurnSummaryModel           `json:"previousTurn"`
	DeckLanguage    string                      `json:"deckLanguage"`
	CreatorID       string                      `json:"creatorId"`
	PsychicCount    int                         `json:"psychicCount"`
	ClueQuota       int                         `json:"clueQuota"`
	MigrationTokens map[string]string           `json:"migrationTokens,omitempty"`
}

type ViewerState struct {
	PlayerID              string `json:"playerId"`
	CanManageRoom         bool   `json:"canManageRoom"`
	CanSetGuess           bool   `json:"canSetGuess"`
	CanSubmitGuess        bool   `json:"canSubmitGuess"`
	CanSubmitCounterGuess bool   `json:"canSubmitCounterGuess"`
	CanSubmitClue         bool   `json:"canSubmitClue"`
	CanStartRound         bool   `json:"canStartRound"`
	CanChangeTeam         bool   `json:"canChangeTeam"`
	EffectiveClueQuota    int    `json:"effectiveClueQuota"`
	SubmittedClueCount    int    `json:"submittedClueCount"`
	IsCurrentPsychic      bool   `json:"isCurrentPsychic"`
	IsTemporaryRep        bool   `json:"isTemporaryRep"`
}

type RoomView struct {
	RoomState
	Viewer ViewerState `json:"viewer"`
}

func InitialRoomState(deckLanguage string) RoomState {
	if strings.TrimSpace(deckLanguage) == "" {
		deckLanguage = "en"
	}
	return RoomState{
		GameType:        GameTypeTeams,
		RoundPhase:      RoundPhaseSetupGame,
		TurnsTaken:      -1,
		DeckSeed:        randomDeckSeed(),
		DeckIndex:       0,
		SpectrumTarget:  randomSpectrumTarget(),
		Clues:           []Clue{},
		Guess:           10,
		CounterGuess:    "left",
		Players:         map[string]PlayerState{},
		PsychicIDs:      []string{},
		ActingTeam:      TeamUnset,
		LeftScore:       0,
		RightScore:      0,
		CoopScore:       0,
		CoopBonusTurns:  0,
		PreviousTurn:    nil,
		DeckLanguage:    deckLanguage,
		CreatorID:       "",
		PsychicCount:    1,
		ClueQuota:       1,
		MigrationTokens: map[string]string{},
	}
}

func randomSpectrumTarget() int {
	return seededRand().Intn(21)
}

func randomDeckSeed() string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"
	rng := seededRand()
	var builder strings.Builder
	for i := 0; i < 4; i++ {
		builder.WriteByte(chars[rng.Intn(len(chars))])
	}
	return builder.String()
}

func seededRand() *mathrand.Rand {
	return mathrand.New(mathrand.NewSource(time.Now().UnixNano()))
}

func randomToken(byteLength int) string {
	buf := make([]byte, byteLength)
	if _, err := rand.Read(buf); err == nil {
		return hex.EncodeToString(buf)
	}
	fallback := seededRand()
	for i := range buf {
		buf[i] = byte(fallback.Intn(256))
	}
	return hex.EncodeToString(buf)
}

func sortedEligiblePlayers(playerIDs []string) []string {
	result := append([]string(nil), playerIDs...)
	sort.Strings(result)
	return result
}

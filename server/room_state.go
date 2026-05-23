package server

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
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
	RoundPhaseReady
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
	GameTypeIndividual
)

const (
	TeamUnset Team = iota
	TeamLeft
	TeamRight
)

type PlayerState struct {
	Name             string `json:"name"`
	DisplayName      string `json:"displayName,omitempty"`
	NameOrdinal      int    `json:"nameOrdinal,omitempty"`
	Team             Team   `json:"team"`
	IsModerator      bool   `json:"isModerator"`
	IsRepresentative bool   `json:"isRepresentative"`
	IsObserver       bool   `json:"isObserver"`
	SessionSecret    string `json:"sessionSecret,omitempty"`
	UserAuthHash     string `json:"userAuthHash,omitempty"`
}

type Clue struct {
	AuthorID   string `json:"authorId"`
	AuthorName string `json:"authorName"`
	Text       string `json:"text"`
	Order      int    `json:"order"`
}

type TurnSummaryModel struct {
	DeckIndex         int            `json:"deckIndex"`
	GameType          GameType       `json:"gameType"`
	ClueAuthorName    string         `json:"clueAuthorName"`
	Clues             []Clue         `json:"clues"`
	Prompt            *WordpackCard  `json:"prompt,omitempty"`
	SpectrumTarget    int            `json:"spectrumTarget"`
	Guess             int            `json:"guess"`
	CounterGuess      string         `json:"counterGuess"`
	ActingTeam        Team           `json:"actingTeam"`
	IndividualGuesses map[string]int `json:"individualGuesses,omitempty"`
}

type PreviousGameResult struct {
	GameType         GameType           `json:"gameType"`
	WinnerTeam       Team               `json:"winnerTeam"`
	LoserTeam        Team               `json:"loserTeam"`
	LeftScore        int                `json:"leftScore"`
	RightScore       int                `json:"rightScore"`
	CoopScore        int                `json:"coopScore"`
	IndividualScores map[string]float64 `json:"individualScores,omitempty"`
	WinnerIDs        []string           `json:"winnerIds,omitempty"`
}

type RoomState struct {
	GameType                             GameType                  `json:"gameType"`
	RoundPhase                           RoundPhase                `json:"roundPhase"`
	TurnsTaken                           int                       `json:"turnsTaken"`
	DeckSeed                             string                    `json:"deckSeed"`
	DeckIndex                            int                       `json:"deckIndex"`
	CurrentPrompt                        *WordpackCard             `json:"currentPrompt,omitempty"`
	SpectrumTarget                       int                       `json:"spectrumTarget"`
	Clues                                []Clue                    `json:"clues"`
	Guess                                int                       `json:"guess"`
	CounterGuess                         string                    `json:"counterGuess"`
	Players                              map[string]PlayerState    `json:"players"`
	PsychicIDs                           []string                  `json:"psychicIds"`
	ActingTeam                           Team                      `json:"actingTeam"`
	LeftScore                            int                       `json:"leftScore"`
	RightScore                           int                       `json:"rightScore"`
	CoopScore                            int                       `json:"coopScore"`
	CoopBonusTurns                       int                       `json:"coopBonusTurns"`
	PreviousTurn                         *TurnSummaryModel         `json:"previousTurn"`
	PreviousGameResult                   *PreviousGameResult       `json:"previousGameResult"`
	DeckLanguage                         string                    `json:"deckLanguage"`
	Wordpack                             string                    `json:"wordpack"`
	Wordpacks                            []string                  `json:"wordpacks"`
	CreatorID                            string                    `json:"creatorId"`
	PsychicCount                         int                       `json:"psychicCount"`
	ClueQuota                            int                       `json:"clueQuota"`
	PsychicRerollLimit                   int                       `json:"psychicRerollLimit"`
	PsychicRerollsUsed                   int                       `json:"psychicRerollsUsed"`
	IndividualScores                     map[string]float64        `json:"individualScores,omitempty"`
	IndividualGuesses                    map[string]int            `json:"individualGuesses,omitempty"`
	IndividualDraftGuesses               map[string]int            `json:"individualDraftGuesses,omitempty"`
	ClueGiverCounts                      map[string]int            `json:"clueGiverCounts,omitempty"`
	IndividualClueGiverTarget            int                       `json:"individualClueGiverTarget"`
	IndividualClueGiverCanSeeLiveGuesses *bool                     `json:"individualClueGiverCanSeeLiveGuesses"`
	RandomizeTeams                       *bool                     `json:"randomizeTeams"`
	TeamsRandomized                      bool                      `json:"teamsRandomized,omitempty"`
	PsychicPickCounts                    map[string]int            `json:"psychicPickCounts,omitempty"`
	MigrationTokens                      map[string]string         `json:"migrationTokens,omitempty"`
	NameOrdinalAssignments               map[string]map[string]int `json:"nameOrdinalAssignments,omitempty"`
	RedirectRoomID                       string                    `json:"redirectRoomId,omitempty"`
}

type ViewerState struct {
	PlayerID                string   `json:"playerId"`
	CanManageRoom           bool     `json:"canManageRoom"`
	CanSetGuess             bool     `json:"canSetGuess"`
	CanSubmitGuess          bool     `json:"canSubmitGuess"`
	CanSubmitCounterGuess   bool     `json:"canSubmitCounterGuess"`
	CanSubmitClue           bool     `json:"canSubmitClue"`
	CanStartRound           bool     `json:"canStartRound"`
	CanChangeTeam           bool     `json:"canChangeTeam"`
	CanRerollRound          bool     `json:"canRerollRound"`
	EffectiveClueQuota      int      `json:"effectiveClueQuota"`
	SubmittedClueCount      int      `json:"submittedClueCount"`
	RemainingPsychicRerolls int      `json:"remainingPsychicRerolls"`
	IsCurrentPsychic        bool     `json:"isCurrentPsychic"`
	IsTemporaryRep          bool     `json:"isTemporaryRep"`
	TemporaryRepIDs         []string `json:"temporaryRepIds"`
}

type RoomView struct {
	RoomState
	RoomID string      `json:"roomId"`
	Viewer ViewerState `json:"viewer"`
}

func InitialRoomState(deckLanguage string) RoomState {
	if strings.TrimSpace(deckLanguage) == "" {
		deckLanguage = "en"
	}
	wordpack := normalizeWordpack(deckLanguage)
	return RoomState{
		GameType:                             GameTypeTeams,
		RoundPhase:                           RoundPhaseSetupGame,
		TurnsTaken:                           -1,
		DeckSeed:                             randomDeckSeed(),
		DeckIndex:                            0,
		SpectrumTarget:                       randomSpectrumTarget(),
		Clues:                                []Clue{},
		Guess:                                10,
		CounterGuess:                         "left",
		Players:                              map[string]PlayerState{},
		PsychicIDs:                           []string{},
		ActingTeam:                           TeamUnset,
		LeftScore:                            0,
		RightScore:                           0,
		CoopScore:                            0,
		CoopBonusTurns:                       0,
		PreviousTurn:                         nil,
		PreviousGameResult:                   nil,
		DeckLanguage:                         deckLanguage,
		Wordpack:                             wordpack,
		Wordpacks:                            []string{wordpack},
		CreatorID:                            "",
		PsychicCount:                         1,
		ClueQuota:                            1,
		PsychicRerollLimit:                   2,
		PsychicRerollsUsed:                   0,
		IndividualScores:                     map[string]float64{},
		IndividualGuesses:                    map[string]int{},
		IndividualDraftGuesses:               map[string]int{},
		ClueGiverCounts:                      map[string]int{},
		IndividualClueGiverTarget:            3,
		IndividualClueGiverCanSeeLiveGuesses: boolPointer(true),
		RandomizeTeams:                       boolPointer(true),
		PsychicPickCounts:                    map[string]int{},
		MigrationTokens:                      map[string]string{},
		NameOrdinalAssignments:               map[string]map[string]int{},
	}
}

func randomSpectrumTarget() int {
	return seededRand().Intn(21)
}

func boolPointer(value bool) *bool {
	return &value
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

func randomRoomID() string {
	return randomDeckSeed()
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

func hashAuthToken(token string) string {
	token = strings.TrimSpace(token)
	if token == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func sortedEligiblePlayers(playerIDs []string) []string {
	result := append([]string(nil), playerIDs...)
	sort.Strings(result)
	return result
}

func normalizedDisplayNameKey(name string) string {
	return strings.ToLower(strings.Join(strings.Fields(name), " "))
}

func assignPlayerName(room *RoomState, playerID string, name string) {
	player := room.Players[playerID]
	player.Name = strings.TrimSpace(name)
	if player.Name == "" {
		player.Name = "Player"
	}
	key := normalizedDisplayNameKey(player.Name)
	if room.NameOrdinalAssignments == nil {
		room.NameOrdinalAssignments = map[string]map[string]int{}
	}
	if room.NameOrdinalAssignments[key] == nil {
		room.NameOrdinalAssignments[key] = map[string]int{}
	}
	ordinal := room.NameOrdinalAssignments[key][playerID]
	if ordinal == 0 {
		ordinal = nextNameOrdinal(room.NameOrdinalAssignments[key])
		room.NameOrdinalAssignments[key][playerID] = ordinal
	}
	player.NameOrdinal = ordinal
	player.DisplayName = displayNameForOrdinal(player.Name, ordinal)
	room.Players[playerID] = player
}

func nextNameOrdinal(assignments map[string]int) int {
	maxOrdinal := 0
	for _, ordinal := range assignments {
		if ordinal > maxOrdinal {
			maxOrdinal = ordinal
		}
	}
	return maxOrdinal + 1
}

func displayNameForOrdinal(name string, ordinal int) string {
	if ordinal <= 1 {
		return name
	}
	return fmt.Sprintf("%s %d", name, ordinal)
}

func assignMissingDisplayNames(room *RoomState) {
	for playerID, player := range room.Players {
		if strings.TrimSpace(player.Name) == "" {
			player.Name = "Player"
			room.Players[playerID] = player
		}
		if player.DisplayName != "" && player.NameOrdinal > 0 {
			continue
		}
		assignPlayerName(room, playerID, player.Name)
	}
}

func normalizeRoomStateShape(room *RoomState) {
	if room.Players == nil {
		room.Players = map[string]PlayerState{}
	}
	if room.Clues == nil {
		room.Clues = []Clue{}
	}
	if room.PsychicIDs == nil {
		room.PsychicIDs = []string{}
	}
	if room.MigrationTokens == nil {
		room.MigrationTokens = map[string]string{}
	}
	if room.PsychicPickCounts == nil {
		room.PsychicPickCounts = map[string]int{}
	}
	if room.NameOrdinalAssignments == nil {
		room.NameOrdinalAssignments = map[string]map[string]int{}
	}
	if room.IndividualScores == nil {
		room.IndividualScores = map[string]float64{}
	}
	if room.IndividualGuesses == nil {
		room.IndividualGuesses = map[string]int{}
	}
	if room.IndividualDraftGuesses == nil {
		room.IndividualDraftGuesses = map[string]int{}
	}
	if room.ClueGiverCounts == nil {
		room.ClueGiverCounts = map[string]int{}
	}
	if room.IndividualClueGiverTarget < 1 {
		room.IndividualClueGiverTarget = 3
	}
	if room.IndividualClueGiverCanSeeLiveGuesses == nil {
		room.IndividualClueGiverCanSeeLiveGuesses = boolPointer(true)
	}
	if room.RandomizeTeams == nil {
		room.RandomizeTeams = boolPointer(true)
	}
	if room.PreviousTurn != nil && room.PreviousTurn.Clues == nil {
		room.PreviousTurn.Clues = []Clue{}
	}
	assignMissingDisplayNames(room)
	if strings.TrimSpace(room.Wordpack) == "" {
		room.Wordpack = normalizeWordpack(room.DeckLanguage)
	} else {
		room.Wordpack = normalizeWordpack(room.Wordpack)
	}
	room.Wordpacks = normalizeWordpackList(room.Wordpacks, room.Wordpack)
	room.Wordpack = room.Wordpacks[0]
	if strings.TrimSpace(room.DeckLanguage) == "" {
		room.DeckLanguage = "en"
	}
	if room.PsychicRerollLimit < 0 {
		room.PsychicRerollLimit = 0
	}
}

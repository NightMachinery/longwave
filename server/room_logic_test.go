package server

import "testing"

func TestChoosePsychicsPrefersLeastUsedEligiblePlayers(t *testing.T) {
	t.Parallel()

	room := InitialRoomState("en")
	room.GameType = GameTypeCooperative
	room.Players = map[string]PlayerState{
		"alice": {
			Name: "Alice",
			Team: TeamUnset,
		},
		"bob": {
			Name: "Bob",
			Team: TeamUnset,
		},
		"carol": {
			Name: "Carol",
			Team: TeamUnset,
		},
	}
	room.PsychicPickCounts = map[string]int{
		"alice": 0,
		"bob":   3,
		"carol": 3,
	}

	selected := choosePsychics(&room, nil, 1)
	if len(selected) != 1 || selected[0] != "alice" {
		t.Fatalf("expected least-used player alice to be selected, got %v", selected)
	}
}

func TestPsychicsKeepSeeingTargetAfterCluePhase(t *testing.T) {
	t.Parallel()

	for _, phase := range []RoundPhase{RoundPhaseMakeGuess, RoundPhaseCounterGuess} {
		room := InitialRoomState("en")
		room.RoundPhase = phase
		room.SpectrumTarget = 7
		room.PsychicIDs = []string{"alice"}
		room.Players = map[string]PlayerState{
			"alice": {Name: "Alice"},
			"bob":   {Name: "Bob"},
		}

		psychicView := sanitizeRoomForViewer(room, "ROOM", "alice")
		if psychicView.SpectrumTarget != 7 {
			t.Fatalf("expected psychic to see target during phase %v, got %d", phase, psychicView.SpectrumTarget)
		}

		nonPsychicView := sanitizeRoomForViewer(room, "ROOM", "bob")
		if nonPsychicView.SpectrumTarget != 0 {
			t.Fatalf("expected non-psychic target to stay hidden during phase %v, got %d", phase, nonPsychicView.SpectrumTarget)
		}
	}
}

func TestUnavailableRepresentativeCreatesSingleTemporarySubmitter(t *testing.T) {
	t.Parallel()

	room := InitialRoomState("en")
	room.GameType = GameTypeTeams
	room.RoundPhase = RoundPhaseMakeGuess
	room.ActingTeam = TeamLeft
	room.PsychicIDs = []string{"alice"}
	room.Players = map[string]PlayerState{
		"alice": {Name: "Alice", Team: TeamLeft, IsRepresentative: true},
		"bob":   {Name: "Bob", Team: TeamLeft},
		"carol": {Name: "Carol", Team: TeamLeft},
		"dana":  {Name: "Dana", Team: TeamRight},
	}

	if !viewerCanSetGuess(&room, "bob") {
		t.Fatalf("expected first fallback player to become temporary representative")
	}
	if viewerCanSetGuess(&room, "carol") {
		t.Fatalf("expected other non-representatives not to set the guess while a temporary representative exists")
	}
	if !viewerTemporaryRep(&room, "bob") {
		t.Fatalf("expected fallback player to be marked as temporary representative")
	}
}

func TestTemporaryRepresentativeUpdatesWhenRepresentativeObservesAndRejoins(t *testing.T) {
	t.Parallel()

	room := InitialRoomState("en")
	room.GameType = GameTypeTeams
	room.RoundPhase = RoundPhaseMakeGuess
	room.ActingTeam = TeamLeft
	room.Players = map[string]PlayerState{
		"alice": {Name: "Alice", Team: TeamLeft, IsRepresentative: true},
		"bob":   {Name: "Bob", Team: TeamLeft},
		"carol": {Name: "Carol", Team: TeamLeft},
	}

	if viewerTemporaryRep(&room, "bob") {
		t.Fatalf("expected no temporary rep while explicit representative is active")
	}

	alice := room.Players["alice"]
	alice.IsObserver = true
	room.Players["alice"] = alice

	if !viewerTemporaryRep(&room, "bob") {
		t.Fatalf("expected bob to become temporary rep after representative observes")
	}

	alice.IsObserver = false
	room.Players["alice"] = alice

	if viewerTemporaryRep(&room, "bob") {
		t.Fatalf("expected temporary rep to clear when representative rejoins")
	}
}

func TestRandomizeTeamAssignmentsBalancesActivePlayers(t *testing.T) {
	t.Parallel()

	room := InitialRoomState("en")
	room.Players = map[string]PlayerState{
		"alice": {Name: "Alice"},
		"bob":   {Name: "Bob"},
		"carol": {Name: "Carol"},
		"dana":  {Name: "Dana"},
		"erin":  {Name: "Erin", IsObserver: true},
	}

	randomizeTeamAssignments(&room)

	leftCount := 0
	rightCount := 0
	for _, player := range room.Players {
		if player.IsObserver {
			if player.Team != TeamUnset {
				t.Fatalf("expected observer to remain unassigned, got %v", player.Team)
			}
			continue
		}
		if player.Team == TeamLeft {
			leftCount++
		}
		if player.Team == TeamRight {
			rightCount++
		}
	}
	if leftCount != 2 || rightCount != 2 {
		t.Fatalf("expected balanced team counts, got left=%d right=%d", leftCount, rightCount)
	}
}

func TestNewTeamGameJoinerIsAssignedToSmallerTeam(t *testing.T) {
	t.Parallel()

	room := InitialRoomState("en")
	room.GameType = GameTypeTeams
	room.Players = map[string]PlayerState{
		"alice": {Name: "Alice", Team: TeamLeft},
		"bob":   {Name: "Bob", Team: TeamLeft},
		"carol": {Name: "Carol", Team: TeamRight},
		"dana":  {Name: "Dana"},
	}

	assignNewPlayerToBalancedTeam(&room, "dana")

	if room.Players["dana"].Team != TeamRight {
		t.Fatalf("expected new joiner to be assigned to smaller right team, got %v", room.Players["dana"].Team)
	}
}

func TestEnterTeamSetupHonorsRandomizeTeamsSetting(t *testing.T) {
	t.Parallel()

	room := InitialRoomState("en")
	disabled := false
	room.RandomizeTeams = &disabled
	room.Players = map[string]PlayerState{
		"alice": {Name: "Alice"},
		"bob":   {Name: "Bob"},
	}

	enterTeamSetup(&room)

	if room.Players["alice"].Team != TeamUnset || room.Players["bob"].Team != TeamUnset {
		t.Fatalf("expected disabled auto-randomization to preserve team assignments")
	}
	if room.TeamsRandomized {
		t.Fatalf("expected disabled auto-randomization not to mark teams randomized")
	}
}

func TestPsychicCanRerollBeforeAnyClue(t *testing.T) {
	t.Parallel()

	room := InitialRoomState("en")
	room.RoundPhase = RoundPhaseGiveClue
	room.PsychicIDs = []string{"bob"}
	room.Players = map[string]PlayerState{
		"alice": {Name: "Alice", IsModerator: true},
		"bob":   {Name: "Bob"},
	}
	initialDeckIndex := room.DeckIndex

	if err := applyAction(&room, "bob", ActionRequest{Type: "reroll_round"}, nil); err != nil {
		t.Fatalf("expected psychic reroll to succeed: %v", err)
	}
	if room.DeckIndex != initialDeckIndex+1 {
		t.Fatalf("expected deck index to advance, got %d", room.DeckIndex)
	}

	room.Clues = []Clue{{AuthorID: "bob", AuthorName: "Bob", Text: "coffee"}}
	if err := applyAction(&room, "bob", ActionRequest{Type: "reroll_round"}, nil); err == nil {
		t.Fatalf("expected reroll after a clue to fail")
	}
}

func TestPsychicRerollLimitIsSharedPerRoundAndModsBypassIt(t *testing.T) {
	t.Parallel()

	room := InitialRoomState("en")
	room.RoundPhase = RoundPhaseGiveClue
	room.PsychicIDs = []string{"bob", "carol"}
	room.Players = map[string]PlayerState{
		"alice": {Name: "Alice", IsModerator: true},
		"bob":   {Name: "Bob"},
		"carol": {Name: "Carol"},
	}

	if err := applyAction(&room, "bob", ActionRequest{Type: "reroll_round"}, nil); err != nil {
		t.Fatalf("expected first psychic reroll to succeed: %v", err)
	}
	if err := applyAction(&room, "carol", ActionRequest{Type: "reroll_round"}, nil); err != nil {
		t.Fatalf("expected second psychic reroll to succeed: %v", err)
	}
	if err := applyAction(&room, "bob", ActionRequest{Type: "reroll_round"}, nil); err == nil {
		t.Fatalf("expected shared psychic reroll limit to reject third reroll")
	}
	if err := applyAction(&room, "alice", ActionRequest{Type: "reroll_round"}, nil); err != nil {
		t.Fatalf("expected moderator reroll to bypass the limit: %v", err)
	}
	if room.PsychicRerollsUsed != 2 {
		t.Fatalf("expected moderator reroll not to increment psychic usage, got %d", room.PsychicRerollsUsed)
	}
}

func TestExactCounterGuessScoresWhenTargetEqualsGuess(t *testing.T) {
	t.Parallel()

	room := InitialRoomState("en")
	room.GameType = GameTypeTeams
	room.RoundPhase = RoundPhaseCounterGuess
	room.ActingTeam = TeamLeft
	room.SpectrumTarget = 8
	room.Guess = 8
	room.Players = map[string]PlayerState{
		"alice": {Name: "Alice", Team: TeamLeft},
		"bob":   {Name: "Bob", Team: TeamRight},
	}

	if err := applyAction(&room, "bob", ActionRequest{Type: "submit_counterguess", CounterGuess: "exact"}, nil); err != nil {
		t.Fatalf("expected exact counterguess to succeed: %v", err)
	}
	if room.LeftScore != 4 || room.RightScore != 1 {
		t.Fatalf("expected left to score 4 and right exact bonus 1, got left=%d right=%d", room.LeftScore, room.RightScore)
	}
}

func TestModeratorCannotMoveCurrentPsychicTeam(t *testing.T) {
	t.Parallel()

	right := int(TeamRight)
	room := InitialRoomState("en")
	room.GameType = GameTypeTeams
	room.RoundPhase = RoundPhaseGiveClue
	room.ActingTeam = TeamLeft
	room.PsychicIDs = []string{"bob"}
	room.Players = map[string]PlayerState{
		"alice": {Name: "Alice", Team: TeamLeft, IsModerator: true},
		"bob":   {Name: "Bob", Team: TeamLeft},
		"carol": {Name: "Carol", Team: TeamLeft},
	}

	if err := applyAction(&room, "alice", ActionRequest{Type: "set_team", PlayerID: "bob", Team: &right}, nil); err == nil {
		t.Fatalf("expected moving a current psychic to fail")
	}
	if err := applyAction(&room, "alice", ActionRequest{Type: "set_team", PlayerID: "carol", Team: &right}, nil); err != nil {
		t.Fatalf("expected moving a non-psychic to succeed: %v", err)
	}
	if room.Players["carol"].Team != TeamRight {
		t.Fatalf("expected carol to move to right team, got %v", room.Players["carol"].Team)
	}
}

func TestPlayAgainStoresPreviousWinnerResult(t *testing.T) {
	t.Parallel()

	room := InitialRoomState("en")
	room.GameType = GameTypeTeams
	room.RoundPhase = RoundPhaseViewScore
	room.CreatorID = "alice"
	room.LeftScore = 10
	room.RightScore = 7
	room.Players = map[string]PlayerState{
		"alice": {Name: "Alice", Team: TeamLeft, IsModerator: true},
		"bob":   {Name: "Bob", Team: TeamRight},
	}

	if err := applyAction(&room, "alice", ActionRequest{Type: "play_again"}, nil); err != nil {
		t.Fatalf("expected play again to succeed: %v", err)
	}
	if room.PreviousGameResult == nil {
		t.Fatalf("expected previous game result to be preserved")
	}
	if room.PreviousGameResult.WinnerTeam != TeamLeft || room.PreviousGameResult.LoserTeam != TeamRight {
		t.Fatalf("expected left winner/right loser, got %#v", room.PreviousGameResult)
	}
	if room.LeftScore != 0 || room.RightScore != 0 {
		t.Fatalf("expected scores to reset, got left=%d right=%d", room.LeftScore, room.RightScore)
	}
}

func TestIndividualRoundAveragesAllNonObserverGuesses(t *testing.T) {
	t.Parallel()

	room := InitialRoomState("en")
	room.GameType = GameTypeIndividual
	room.RoundPhase = RoundPhaseMakeGuess
	room.SpectrumTarget = 10
	room.PsychicIDs = []string{"alice"}
	room.Players = map[string]PlayerState{
		"alice": {Name: "Alice"},
		"bob":   {Name: "Bob"},
		"carol": {Name: "Carol"},
		"dana":  {Name: "Dana", IsObserver: true},
	}

	if err := applyAction(&room, "bob", ActionRequest{Type: "submit_individual_guess", Guess: intPointer(10)}, nil); err != nil {
		t.Fatalf("expected bob guess to succeed: %v", err)
	}
	if room.RoundPhase != RoundPhaseMakeGuess {
		t.Fatalf("expected round to wait for carol, got phase %v", room.RoundPhase)
	}
	if err := applyAction(&room, "carol", ActionRequest{Type: "submit_individual_guess", Guess: intPointer(0)}, nil); err != nil {
		t.Fatalf("expected carol guess to succeed: %v", err)
	}
	if room.RoundPhase != RoundPhaseViewScore {
		t.Fatalf("expected individual round to reveal after all guesses, got phase %v", room.RoundPhase)
	}
	if room.IndividualScores["alice"] != 2 {
		t.Fatalf("expected clue giver average score 2, got %.2f", room.IndividualScores["alice"])
	}
}

func TestSetIndividualModeWaitsForEnoughActivePlayers(t *testing.T) {
	t.Parallel()

	individual := int(GameTypeIndividual)
	room := InitialRoomState("en")
	room.Players = map[string]PlayerState{
		"alice": {Name: "Alice", IsModerator: true},
	}

	if err := applyAction(&room, "alice", ActionRequest{Type: "set_game_type", GameType: &individual}, nil); err != nil {
		t.Fatalf("expected setting individual mode to succeed with one player: %v", err)
	}
	if room.RoundPhase != RoundPhaseReady {
		t.Fatalf("expected individual mode to wait in ready lobby, got %v", room.RoundPhase)
	}
	normalizeRoundState(&room)
	if canStartRound(&room, "alice") {
		t.Fatalf("expected start round to be disabled until a second active player joins")
	}

	room.Players["bob"] = PlayerState{Name: "Bob"}
	normalizeRoundState(&room)
	if !canStartRound(&room, "alice") {
		t.Fatalf("expected start round to be enabled with two active players")
	}
}

func TestIndividualRejectsDuplicateAndClueGiverGuesses(t *testing.T) {
	t.Parallel()

	room := InitialRoomState("en")
	room.GameType = GameTypeIndividual
	room.RoundPhase = RoundPhaseMakeGuess
	room.PsychicIDs = []string{"alice"}
	room.Players = map[string]PlayerState{
		"alice": {Name: "Alice"},
		"bob":   {Name: "Bob"},
		"carol": {Name: "Carol"},
	}

	if err := applyAction(&room, "alice", ActionRequest{Type: "submit_individual_guess", Guess: intPointer(10)}, nil); err == nil {
		t.Fatalf("expected clue giver guess to fail")
	}
	if err := applyAction(&room, "bob", ActionRequest{Type: "submit_individual_guess", Guess: intPointer(10)}, nil); err != nil {
		t.Fatalf("expected first bob guess to succeed: %v", err)
	}
	if err := applyAction(&room, "bob", ActionRequest{Type: "submit_individual_guess", Guess: intPointer(11)}, nil); err == nil {
		t.Fatalf("expected duplicate bob guess to fail")
	}
}

func TestIndividualGameOverUsesCurrentActiveRoster(t *testing.T) {
	t.Parallel()

	room := InitialRoomState("en")
	room.GameType = GameTypeIndividual
	room.RoundPhase = RoundPhaseViewScore
	room.IndividualClueGiverTarget = 1
	room.Players = map[string]PlayerState{
		"alice": {Name: "Alice"},
		"bob":   {Name: "Bob"},
		"carol": {Name: "Carol", IsObserver: true},
	}
	room.ClueGiverCounts = map[string]int{"alice": 1, "bob": 1, "carol": 0}

	if !isGameOver(&room) {
		t.Fatalf("expected observers to be ignored by individual game-over check")
	}

	room.Players["dana"] = PlayerState{Name: "Dana"}
	normalizeRoomStateShape(&room)
	if isGameOver(&room) {
		t.Fatalf("expected active late joiner to extend individual game")
	}
}

func TestIndividualSanitizedGuessesHideOtherPlayersBeforeReveal(t *testing.T) {
	t.Parallel()

	room := InitialRoomState("en")
	room.GameType = GameTypeIndividual
	room.RoundPhase = RoundPhaseMakeGuess
	room.PsychicIDs = []string{"alice"}
	room.Players = map[string]PlayerState{
		"alice": {Name: "Alice"},
		"bob":   {Name: "Bob"},
		"carol": {Name: "Carol"},
	}
	room.IndividualGuesses = map[string]int{"bob": 7, "carol": 12}

	bobView := sanitizeRoomForViewer(room, "ROOM", "bob")
	if bobView.IndividualGuesses["bob"] != 7 {
		t.Fatalf("expected bob to see own guess, got %d", bobView.IndividualGuesses["bob"])
	}
	if bobView.IndividualGuesses["carol"] != -1 {
		t.Fatalf("expected bob to see only carol submission status, got %d", bobView.IndividualGuesses["carol"])
	}

	room.RoundPhase = RoundPhaseViewScore
	revealView := sanitizeRoomForViewer(room, "ROOM", "bob")
	if revealView.IndividualGuesses["carol"] != 12 {
		t.Fatalf("expected reveal to include carol guess, got %d", revealView.IndividualGuesses["carol"])
	}
}

func intPointer(value int) *int {
	return &value
}

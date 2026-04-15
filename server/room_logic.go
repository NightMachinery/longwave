package server

import (
	"errors"
	"fmt"
	mathrand "math/rand"
	"sort"
	"strings"
)

var errUnauthorized = errors.New("unauthorized")

func teamReverse(team Team) Team {
	if team == TeamLeft {
		return TeamRight
	}
	if team == TeamRight {
		return TeamLeft
	}
	return TeamUnset
}

func getScore(target int, guess int) int {
	difference := target - guess
	if difference < 0 {
		difference = -difference
	}
	if difference > 2 {
		return 0
	}
	return 4 - difference
}

type ActionRequest struct {
	Type         string `json:"type"`
	PlayerID     string `json:"playerId,omitempty"`
	Name         string `json:"name,omitempty"`
	GameType     *int   `json:"gameType,omitempty"`
	Team         *int   `json:"team,omitempty"`
	PsychicCount *int   `json:"psychicCount,omitempty"`
	ClueQuota    *int   `json:"clueQuota,omitempty"`
	Guess        *int   `json:"guess,omitempty"`
	CounterGuess string `json:"counterGuess,omitempty"`
	Clue         string `json:"clue,omitempty"`
	Value        *bool  `json:"value,omitempty"`
}

func applyAction(room *RoomState, viewerID string, action ActionRequest) error {
	if _, ok := room.Players[viewerID]; !ok {
		return errUnauthorized
	}

	switch action.Type {
	case "set_name":
		name := strings.TrimSpace(action.Name)
		if name == "" {
			return fmt.Errorf("name is required")
		}
		player := room.Players[viewerID]
		player.Name = name
		room.Players[viewerID] = player
		return nil
	case "set_game_type":
		if !canManageRoom(room, viewerID) || action.GameType == nil {
			return errUnauthorized
		}
		room.GameType = GameType(*action.GameType)
		if room.GameType == GameTypeTeams {
			room.RoundPhase = RoundPhasePickTeams
			room.ActingTeam = TeamUnset
		} else {
			resetScoresForGameType(room)
			return startRound(room, viewerID)
		}
		room.Clues = []Clue{}
		room.PsychicIDs = []string{}
		return nil
	case "join_team":
		if action.Team == nil {
			return fmt.Errorf("team is required")
		}
		player := room.Players[viewerID]
		if player.IsObserver {
			return fmt.Errorf("observer cannot join a team")
		}
		player.Team = Team(*action.Team)
		room.Players[viewerID] = player
		return nil
	case "start_round":
		return startRound(room, viewerID)
	case "set_psychic_count":
		if !canManageRoom(room, viewerID) || action.PsychicCount == nil {
			return errUnauthorized
		}
		if *action.PsychicCount < 1 {
			room.PsychicCount = 1
		} else {
			room.PsychicCount = *action.PsychicCount
		}
		normalizeRoundState(room)
		return nil
	case "set_clue_quota":
		if !canManageRoom(room, viewerID) || action.ClueQuota == nil {
			return errUnauthorized
		}
		if *action.ClueQuota < 1 {
			room.ClueQuota = 1
		} else {
			room.ClueQuota = *action.ClueQuota
		}
		normalizeRoundState(room)
		return nil
	case "submit_clue":
		return submitClue(room, viewerID, action.Clue)
	case "set_guess":
		if action.Guess == nil || !viewerCanSetGuess(room, viewerID) {
			return errUnauthorized
		}
		guess := *action.Guess
		if guess < 0 {
			guess = 0
		}
		if guess > 20 {
			guess = 20
		}
		room.Guess = guess
		return nil
	case "submit_guess":
		if !viewerCanSubmitGuess(room, viewerID) {
			return errUnauthorized
		}
		if room.GameType == GameTypeTeams {
			room.RoundPhase = RoundPhaseCounterGuess
			return nil
		}
		if room.GameType == GameTypeCooperative {
			score := getScore(room.SpectrumTarget, room.Guess)
			room.RoundPhase = RoundPhaseViewScore
			if score == 4 {
				room.CoopScore += 3
				room.CoopBonusTurns += 1
			} else {
				room.CoopScore += score
			}
			return nil
		}
		room.RoundPhase = RoundPhaseViewScore
		return nil
	case "submit_counterguess":
		if !viewerCanSubmitCounterGuess(room, viewerID) {
			return errUnauthorized
		}
		if action.CounterGuess != "left" && action.CounterGuess != "right" {
			return fmt.Errorf("counterGuess must be left or right")
		}
		room.RoundPhase = RoundPhaseViewScore
		room.CounterGuess = action.CounterGuess
		pointsScored := getScore(room.SpectrumTarget, room.Guess)
		wasCounterGuessCorrect :=
			(action.CounterGuess == "left" && room.SpectrumTarget < room.Guess) ||
				(action.CounterGuess == "right" && room.SpectrumTarget > room.Guess)
		if room.ActingTeam == TeamLeft {
			room.LeftScore += pointsScored
			if wasCounterGuessCorrect {
				room.RightScore += 1
			}
		} else if room.ActingTeam == TeamRight {
			room.RightScore += pointsScored
			if wasCounterGuessCorrect {
				room.LeftScore += 1
			}
		}
		return nil
	case "set_moderator":
		return setPlayerFlag(room, viewerID, action.PlayerID, action.Value, func(p *PlayerState, v bool) {
			p.IsModerator = v
		})
	case "set_representative":
		return setPlayerFlag(room, viewerID, action.PlayerID, action.Value, func(p *PlayerState, v bool) {
			p.IsRepresentative = v
		})
	case "set_observer":
		if !canManageRoom(room, viewerID) || action.PlayerID == "" || action.Value == nil {
			return errUnauthorized
		}
		player, ok := room.Players[action.PlayerID]
		if !ok {
			return fmt.Errorf("player not found")
		}
		player.IsObserver = *action.Value
		room.Players[action.PlayerID] = player
		normalizeRoundState(room)
		return nil
	case "reset_room":
		if !canManageRoom(room, viewerID) {
			return errUnauthorized
		}
		preservedPlayers := room.Players
		creatorID := room.CreatorID
		psychicCount := room.PsychicCount
		clueQuota := room.ClueQuota
		deckLanguage := room.DeckLanguage
		*room = InitialRoomState(deckLanguage)
		room.Players = preservedPlayers
		room.CreatorID = creatorID
		room.PsychicCount = psychicCount
		room.ClueQuota = clueQuota
		return nil
	default:
		return fmt.Errorf("unsupported action type %q", action.Type)
	}
}

func setPlayerFlag(room *RoomState, viewerID string, targetID string, value *bool, update func(*PlayerState, bool)) error {
	if !canManageRoom(room, viewerID) || targetID == "" || value == nil {
		return errUnauthorized
	}
	if targetID == room.CreatorID && update != nil {
		// creator mod demotion is blocked below by id check + no-op for moderator only
	}
	player, ok := room.Players[targetID]
	if !ok {
		return fmt.Errorf("player not found")
	}
	if targetID == room.CreatorID {
		if player.IsModerator && !*value {
			return fmt.Errorf("creator cannot be demoted")
		}
	}
	update(&player, *value)
	if targetID == room.CreatorID {
		player.IsModerator = true
	}
	room.Players[targetID] = player
	return nil
}

func canManageRoom(room *RoomState, viewerID string) bool {
	player, ok := room.Players[viewerID]
	return ok && player.IsModerator
}

func isPsychic(room *RoomState, playerID string) bool {
	for _, psychicID := range room.PsychicIDs {
		if psychicID == playerID {
			return true
		}
	}
	return false
}

func activePlayerIDs(room *RoomState) []string {
	ids := make([]string, 0, len(room.Players))
	for playerID, player := range room.Players {
		if player.IsObserver {
			continue
		}
		ids = append(ids, playerID)
	}
	return sortedEligiblePlayers(ids)
}

func eligiblePsychicIDs(room *RoomState) []string {
	ids := []string{}
	for _, playerID := range activePlayerIDs(room) {
		player := room.Players[playerID]
		if room.GameType == GameTypeTeams && player.Team != room.ActingTeam {
			continue
		}
		ids = append(ids, playerID)
	}
	return ids
}

func effectiveClueQuota(room *RoomState) int {
	eligibleCount := len(eligiblePsychicIDs(room))
	quota := room.ClueQuota
	if quota < 1 {
		quota = 1
	}
	if eligibleCount == 0 {
		return 0
	}
	if quota > eligibleCount {
		return eligibleCount
	}
	return quota
}

func choosePsychics(room *RoomState) []string {
	eligible := eligiblePsychicIDs(room)
	if len(eligible) == 0 {
		return []string{}
	}
	count := room.PsychicCount
	if count < 1 {
		count = 1
	}
	if count > len(eligible) {
		count = len(eligible)
	}
	rng := mathrand.New(mathrand.NewSource(timeSeed()))
	rng.Shuffle(len(eligible), func(i, j int) {
		eligible[i], eligible[j] = eligible[j], eligible[i]
	})
	selected := append([]string(nil), eligible[:count]...)
	sort.Strings(selected)
	return selected
}

func timeSeed() int64 { return seededRand().Int63() }

func viewerCanSetGuess(room *RoomState, viewerID string) bool {
	return room.RoundPhase == RoundPhaseMakeGuess && viewerCanSubmitGuess(room, viewerID)
}

func viewerCanSubmitGuess(room *RoomState, viewerID string) bool {
	if room.RoundPhase != RoundPhaseMakeGuess {
		return false
	}
	pool := guessingPool(room)
	return containsString(pool.allowedSubmitters, viewerID)
}

func viewerCanSubmitCounterGuess(room *RoomState, viewerID string) bool {
	if room.RoundPhase != RoundPhaseCounterGuess {
		return false
	}
	pool := counterGuessPool(room)
	return containsString(pool.allowedSubmitters, viewerID)
}

func submitClue(room *RoomState, viewerID string, clueText string) error {
	if room.RoundPhase != RoundPhaseGiveClue {
		return fmt.Errorf("clues are closed")
	}
	if !isPsychic(room, viewerID) {
		return errUnauthorized
	}
	if strings.TrimSpace(clueText) == "" {
		return fmt.Errorf("clue is required")
	}
	for _, existing := range room.Clues {
		if existing.AuthorID == viewerID {
			return fmt.Errorf("psychics may only submit one clue")
		}
	}
	if len(room.Clues) >= effectiveClueQuota(room) {
		return fmt.Errorf("clue quota reached")
	}
	player := room.Players[viewerID]
	room.Clues = append(room.Clues, Clue{
		AuthorID:   viewerID,
		AuthorName: player.Name,
		Text:       strings.TrimSpace(clueText),
		Order:      len(room.Clues),
	})
	if len(room.Clues) >= effectiveClueQuota(room) {
		room.RoundPhase = RoundPhaseMakeGuess
		if room.Guess < 0 || room.Guess > 20 {
			room.Guess = 10
		}
	}
	return nil
}

func resetScoresForGameType(room *RoomState) {
	room.LeftScore = 0
	room.RightScore = 0
	room.CoopScore = 0
	room.CoopBonusTurns = 0
	room.PreviousTurn = nil
	room.Clues = []Clue{}
	room.PsychicIDs = []string{}
	room.Guess = 10
	room.CounterGuess = "left"
	room.TurnsTaken = -1
	room.DeckIndex = 0
	room.ActingTeam = TeamUnset
}

func startRound(room *RoomState, viewerID string) error {
	player, ok := room.Players[viewerID]
	if !ok || player.IsObserver {
		return errUnauthorized
	}
	if room.GameType == GameTypeTeams {
		if room.RoundPhase == RoundPhaseSetupGame {
			room.RoundPhase = RoundPhasePickTeams
			return nil
		}
		if room.RoundPhase == RoundPhasePickTeams {
			if player.Team == TeamUnset {
				return fmt.Errorf("join a team first")
			}
			if room.TurnsTaken < 0 {
				room.LeftScore = 0
				room.RightScore = 0
				if player.Team == TeamLeft {
					room.RightScore = 1
				} else {
					room.LeftScore = 1
				}
			}
			room.ActingTeam = player.Team
		} else if room.RoundPhase == RoundPhaseViewScore {
			nextTeam := teamReverse(room.ActingTeam)
			score := getScore(room.SpectrumTarget, room.Guess)
			if score == 4 {
				if room.ActingTeam == TeamLeft && room.LeftScore < room.RightScore {
					nextTeam = TeamLeft
				}
				if room.ActingTeam == TeamRight && room.RightScore < room.LeftScore {
					nextTeam = TeamRight
				}
			}
			if player.Team != nextTeam {
				return errUnauthorized
			}
			room.ActingTeam = nextTeam
		}
	}
	if room.GameType != GameTypeTeams && room.RoundPhase == RoundPhaseViewScore && player.IsObserver {
		return errUnauthorized
	}
	if room.TurnsTaken >= 0 {
		clueAuthorName := ""
		if len(room.Clues) > 0 {
			clueAuthorName = room.Clues[0].AuthorName
		}
		room.PreviousTurn = &TurnSummaryModel{
			DeckIndex:      room.DeckIndex,
			ClueAuthorName: clueAuthorName,
			Clues:          append([]Clue(nil), room.Clues...),
			SpectrumTarget: room.SpectrumTarget,
			Guess:          room.Guess,
		}
	}
	room.RoundPhase = RoundPhaseGiveClue
	room.TurnsTaken += 1
	room.DeckIndex += 1
	room.SpectrumTarget = randomSpectrumTarget()
	room.Clues = []Clue{}
	room.Guess = 10
	room.CounterGuess = "left"
	room.PsychicIDs = choosePsychics(room)
	if len(room.PsychicIDs) == 0 {
		return fmt.Errorf("no eligible psychics available")
	}
	return nil
}

type actingPool struct {
	allActive         []string
	explicitReps      []string
	availableReps     []string
	candidateFallback []string
	allowedSubmitters []string
}

func guessingPool(room *RoomState) actingPool {
	return actingPoolForPhase(room, false)
}

func counterGuessPool(room *RoomState) actingPool {
	return actingPoolForPhase(room, true)
}

func actingPoolForPhase(room *RoomState, counter bool) actingPool {
	pool := actingPool{}
	for _, playerID := range activePlayerIDs(room) {
		player := room.Players[playerID]
		if room.GameType == GameTypeTeams {
			targetTeam := room.ActingTeam
			if counter {
				targetTeam = teamReverse(room.ActingTeam)
			}
			if player.Team != targetTeam {
				continue
			}
		}
		if isPsychic(room, playerID) {
			continue
		}
		pool.allActive = append(pool.allActive, playerID)
		if player.IsRepresentative {
			pool.explicitReps = append(pool.explicitReps, playerID)
			pool.availableReps = append(pool.availableReps, playerID)
		} else {
			pool.candidateFallback = append(pool.candidateFallback, playerID)
		}
	}
	if len(pool.explicitReps) == 0 {
		pool.allowedSubmitters = append([]string(nil), pool.allActive...)
		return pool
	}
	pool.allowedSubmitters = append([]string(nil), pool.availableReps...)
	neededFallback := len(pool.explicitReps) - len(pool.availableReps)
	if neededFallback > len(pool.candidateFallback) {
		neededFallback = len(pool.candidateFallback)
	}
	pool.allowedSubmitters = append(pool.allowedSubmitters, pool.candidateFallback[:neededFallback]...)
	sort.Strings(pool.allowedSubmitters)
	return pool
}

func normalizeRoundState(room *RoomState) {
	if room.CreatorID != "" {
		creator := room.Players[room.CreatorID]
		creator.IsModerator = true
		room.Players[room.CreatorID] = creator
	}
	if room.PsychicCount < 1 {
		room.PsychicCount = 1
	}
	if room.ClueQuota < 1 {
		room.ClueQuota = 1
	}
	filteredPsychics := make([]string, 0, len(room.PsychicIDs))
	for _, psychicID := range room.PsychicIDs {
		player, ok := room.Players[psychicID]
		if !ok || player.IsObserver {
			continue
		}
		if room.GameType == GameTypeTeams && player.Team != room.ActingTeam {
			continue
		}
		filteredPsychics = append(filteredPsychics, psychicID)
	}
	room.PsychicIDs = filteredPsychics
	if room.RoundPhase == RoundPhaseGiveClue {
		needed := room.PsychicCount - len(room.PsychicIDs)
		if needed > 0 {
			for _, candidate := range choosePsychics(room) {
				if containsString(room.PsychicIDs, candidate) {
					continue
				}
				room.PsychicIDs = append(room.PsychicIDs, candidate)
				needed--
				if needed == 0 {
					break
				}
			}
		}
		if len(room.Clues) >= effectiveClueQuota(room) && effectiveClueQuota(room) > 0 {
			room.RoundPhase = RoundPhaseMakeGuess
		}
	}
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func sanitizeRoomForViewer(room RoomState, viewerID string) RoomView {
	normalizeRoomStateShape(&room)
	view := RoomView{RoomState: room}
	view.MigrationTokens = nil
	players := map[string]PlayerState{}
	for playerID, player := range room.Players {
		player.SessionSecret = ""
		players[playerID] = player
	}
	view.Players = players
	viewerPlayer := players[viewerID]
	view.Viewer = ViewerState{
		PlayerID:              viewerID,
		CanManageRoom:         viewerPlayer.IsModerator,
		CanSetGuess:           viewerCanSetGuess(&room, viewerID),
		CanSubmitGuess:        viewerCanSubmitGuess(&room, viewerID),
		CanSubmitCounterGuess: viewerCanSubmitCounterGuess(&room, viewerID),
		CanSubmitClue:         room.RoundPhase == RoundPhaseGiveClue && isPsychic(&room, viewerID) && len(room.Clues) < effectiveClueQuota(&room) && !playerHasSubmittedClue(room, viewerID),
		CanStartRound:         canStartRound(&room, viewerID),
		CanChangeTeam:         !viewerPlayer.IsObserver,
		EffectiveClueQuota:    effectiveClueQuota(&room),
		SubmittedClueCount:    len(room.Clues),
		IsCurrentPsychic:      isPsychic(&room, viewerID),
		IsTemporaryRep:        viewerTemporaryRep(&room, viewerID),
	}
	if !canSeeTarget(&room, viewerID) {
		view.SpectrumTarget = 0
	}
	if room.RoundPhase == RoundPhaseGiveClue && !isPsychic(&room, viewerID) {
		view.Clues = []Clue{}
	}
	return view
}

func playerHasSubmittedClue(room RoomState, viewerID string) bool {
	for _, clue := range room.Clues {
		if clue.AuthorID == viewerID {
			return true
		}
	}
	return false
}

func viewerTemporaryRep(room *RoomState, viewerID string) bool {
	guessPool := guessingPool(room)
	counterPool := counterGuessPool(room)
	player := room.Players[viewerID]
	return containsString(guessPool.allowedSubmitters, viewerID) && !player.IsRepresentative || containsString(counterPool.allowedSubmitters, viewerID) && !player.IsRepresentative
}

func canSeeTarget(room *RoomState, viewerID string) bool {
	if room.RoundPhase == RoundPhaseViewScore {
		return true
	}
	return room.RoundPhase == RoundPhaseGiveClue && isPsychic(room, viewerID)
}

func canStartRound(room *RoomState, viewerID string) bool {
	player, ok := room.Players[viewerID]
	if !ok || player.IsObserver {
		return false
	}
	if room.RoundPhase == RoundPhaseSetupGame {
		return true
	}
	if room.GameType == GameTypeTeams {
		if room.RoundPhase == RoundPhasePickTeams {
			return player.Team != TeamUnset
		}
		if room.RoundPhase != RoundPhaseViewScore {
			return false
		}
		nextTeam := teamReverse(room.ActingTeam)
		score := getScore(room.SpectrumTarget, room.Guess)
		if score == 4 {
			if room.ActingTeam == TeamLeft && room.LeftScore < room.RightScore {
				nextTeam = TeamLeft
			}
			if room.ActingTeam == TeamRight && room.RightScore < room.LeftScore {
				nextTeam = TeamRight
			}
		}
		return player.Team == nextTeam
	}
	return room.RoundPhase == RoundPhaseViewScore || room.RoundPhase == RoundPhaseSetupGame
}

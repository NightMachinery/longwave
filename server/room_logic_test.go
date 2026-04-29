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

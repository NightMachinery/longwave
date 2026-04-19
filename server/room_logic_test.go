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

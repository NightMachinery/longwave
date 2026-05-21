import { GameType, InitialGameState, Team } from "../../state/GameState";
import { render } from "@testing-library/react";
import { Scoreboard } from "./Scoreboard";
import { TestContext } from "./TestContext";

test("shows Individual standings and clue giver progress", () => {
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        gameType: GameType.Individual,
        individualClueGiverTarget: 2,
        individualScores: {
          alice: 3.5,
          bob: 1,
        },
        clueGiverCounts: {
          alice: 1,
          bob: 0,
        },
        players: {
          alice: {
            name: "Alice",
            team: Team.Unset,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
          bob: {
            name: "Bob",
            team: Team.Unset,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
        },
      }}
      playerId="alice"
    >
      <Scoreboard />
    </TestContext>
  );

  expect(component.getByText("Individual")).toBeTruthy();
  expect(component.getByText(/Alice:/)).toBeTruthy();
  expect(component.getByText(/3.5/)).toBeTruthy();
  expect(component.getByText(/Clue giver 1\/2/)).toBeTruthy();
});

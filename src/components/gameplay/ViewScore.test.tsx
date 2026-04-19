import { InitialGameState, RoundPhase, Team } from "../../state/GameState";
import { ViewScore } from "./ViewScore";
import { render } from "@testing-library/react";
import { TestContext } from "./TestContext";

test("shows the computed score", () => {
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        actingTeam: Team.Left,
        spectrumTarget: 1,
        guess: 1,
        clues: [
          {
            authorId: "player1",
            authorName: "Player 1",
            text: "coffee",
            order: 0,
          },
        ],
      }}
      playerId="player1"
    >
      <ViewScore />
    </TestContext>
  );

  expect(component.getByText(/Score/i)).not.toBeNull();
  expect(component.getByText(/coffee/)).not.toBeNull();
});

test("shows play again for moderators when the game is over", () => {
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        actingTeam: Team.Left,
        roundPhase: RoundPhase.ViewScore,
        leftScore: 10,
        rightScore: 7,
        viewer: {
          ...InitialGameState().viewer,
          canManageRoom: true,
        },
      }}
      playerId="player1"
    >
      <ViewScore />
    </TestContext>
  );

  expect(component.getByRole("button", { name: "Play again" })).toBeTruthy();
});

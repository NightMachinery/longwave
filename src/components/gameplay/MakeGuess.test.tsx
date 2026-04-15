import { InitialGameState, Team } from "../../state/GameState";
import { MakeGuess } from "./MakeGuess";
import { render } from "@testing-library/react";
import { TestContext } from "./TestContext";

test("shows the submitted clues", () => {
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        players: {
          player1: {
            name: "Player 1",
            team: Team.Left,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
        },
        viewer: {
          ...InitialGameState().viewer,
        },
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
      <MakeGuess />
    </TestContext>
  );

  expect(component.getByText(/coffee/)).not.toBeNull();
});

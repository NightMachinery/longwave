import { GameType, InitialGameState, RoundPhase, Team } from "../../state/GameState";
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
  expect(component.getByText("Winner")).toBeTruthy();
  expect(component.getByText("Loser")).toBeTruthy();
  expect(component.getByText("10-7")).toBeTruthy();
});

test("shows Individual average score and tied winners", () => {
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        gameType: GameType.Individual,
        roundPhase: RoundPhase.ViewScore,
        spectrumTarget: 10,
        psychicIds: ["alice"],
        individualGuesses: {
          bob: 10,
          carol: 0,
        },
        individualScores: {
          alice: 2,
          bob: 2,
          carol: 1,
        },
        clueGiverCounts: {
          alice: 1,
          bob: 1,
          carol: 1,
        },
        individualClueGiverTarget: 1,
        clues: [
          {
            authorId: "alice",
            authorName: "Alice",
            text: "coffee",
            order: 0,
          },
        ],
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
          carol: {
            name: "Carol",
            team: Team.Unset,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
        },
      }}
      playerId="alice"
    >
      <ViewScore />
    </TestContext>
  );

  expect(component.getByText("Alice scores 2.0 points.")).toBeTruthy();
  expect(component.getByText("Winner: Alice, Bob")).toBeTruthy();
  expect(component.getByText(/coffee/)).toBeTruthy();
});

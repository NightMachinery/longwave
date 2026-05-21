import { GameType, InitialGameState, RoundPhase, Team } from "../../state/GameState";
import { MakeGuess } from "./MakeGuess";
import { fireEvent, render } from "@testing-library/react";
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

test("shows psychics the true target during guessing", () => {
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        roundPhase: RoundPhase.MakeGuess,
        spectrumTarget: 7,
        viewer: {
          ...InitialGameState().viewer,
          isCurrentPsychic: true,
        },
        players: {
          psychic1: {
            name: "Psychic",
            team: Team.Left,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
        },
      }}
      playerId="psychic1"
    >
      <MakeGuess />
    </TestContext>
  );

  expect(component.getByText("True target")).not.toBeNull();
});

test("submits an individual guess", () => {
  const submitAction = jest.fn();
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        gameType: GameType.Individual,
        roundPhase: RoundPhase.MakeGuess,
        psychicIds: ["psychic1"],
        players: {
          psychic1: {
            name: "Psychic",
            team: Team.Unset,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
          player1: {
            name: "Player 1",
            team: Team.Unset,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
        },
        clues: [
          {
            authorId: "psychic1",
            authorName: "Psychic",
            text: "coffee",
            order: 0,
          },
        ],
        viewer: {
          ...InitialGameState().viewer,
          canSubmitGuess: true,
          canSetGuess: true,
        },
      }}
      playerId="player1"
      submitAction={submitAction}
    >
      <MakeGuess />
    </TestContext>
  );

  fireEvent.click(component.getByRole("button", { name: "Submit your guess" }));

  expect(submitAction).toHaveBeenCalledWith({ type: "submit_individual_guess", guess: 10 });
});

test("shows individual live guess dots when the server reveals drafts", () => {
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        gameType: GameType.Individual,
        roundPhase: RoundPhase.MakeGuess,
        spectrumTarget: 8,
        psychicIds: ["psychic1"],
        individualDraftGuesses: {
          player1: 12,
        },
        players: {
          psychic1: {
            name: "Psychic",
            team: Team.Unset,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
          player1: {
            name: "Player 1",
            team: Team.Unset,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
        },
        viewer: {
          ...InitialGameState().viewer,
          isCurrentPsychic: true,
        },
      }}
      playerId="psychic1"
    >
      <MakeGuess />
    </TestContext>
  );

  expect(component.getByTitle("Player 1")).toBeTruthy();
});

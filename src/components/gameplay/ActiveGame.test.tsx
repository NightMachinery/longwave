import { render } from "@testing-library/react";
import { GameType, InitialGameState, RoundPhase, Team } from "../../state/GameState";
import { hintSoundEffectsKey, hintVisualEffectsKey } from "../../utils/localPreferences";
import { ActiveGame } from "./ActiveGame";
import { TestContext } from "./TestContext";

describe("hint arrival effects", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("does not show hint effects for clues present on first render", () => {
    const component = render(
      <TestContext
        gameState={{
          ...InitialGameState(),
          gameType: GameType.Cooperative,
          roundPhase: RoundPhase.MakeGuess,
          clues: [{ authorId: "psychic1", authorName: "Psychic", text: "coffee", order: 0 }],
          players: {
            player1: {
              name: "Player",
              team: Team.Unset,
              isModerator: false,
              isRepresentative: false,
              isObserver: false,
            },
          },
        }}
        playerId="player1"
      >
        <ActiveGame />
      </TestContext>
    );

    expect(component.container.querySelector(".hint-arrival-effect")).toBeNull();
  });

  test("shows a visual hint effect when a new clue becomes visible", () => {
    const baseGameState = {
      ...InitialGameState(),
      gameType: GameType.Cooperative,
      roundPhase: RoundPhase.MakeGuess,
      players: {
        player1: {
          name: "Player",
          team: Team.Unset,
          isModerator: false,
          isRepresentative: false,
          isObserver: false,
        },
      },
    };
    const component = render(
      <TestContext gameState={baseGameState} playerId="player1">
        <ActiveGame />
      </TestContext>
    );

    component.rerender(
      <TestContext
        gameState={{
          ...baseGameState,
          clues: [{ authorId: "psychic1", authorName: "Psychic", text: "coffee", order: 0 }],
        }}
        playerId="player1"
      >
        <ActiveGame />
      </TestContext>
    );

    expect(component.container.querySelector(".hint-arrival-effect")).not.toBeNull();
  });

  test("persists effect defaults locally", () => {
    render(
      <TestContext
        gameState={{
          ...InitialGameState(),
          gameType: GameType.Cooperative,
          roundPhase: RoundPhase.MakeGuess,
        }}
        playerId="player1"
      >
        <ActiveGame />
      </TestContext>
    );

    expect(localStorage.getItem(hintVisualEffectsKey)).toBe("true");
    expect(localStorage.getItem(hintSoundEffectsKey)).toBe("true");
  });
});

test("shows the previous round above player cards with results", () => {
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        gameType: GameType.Cooperative,
        roundPhase: RoundPhase.MakeGuess,
        previousTurn: {
          deckIndex: 0,
          gameType: GameType.Cooperative,
          clueAuthorName: "Psychic",
          clues: [{ authorId: "psychic1", authorName: "Psychic", text: "coffee", order: 0 }],
          spectrumTarget: 10,
          guess: 10,
          individualGuesses: {},
        },
        players: {
          player1: {
            name: "Player",
            team: Team.Unset,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
        },
      }}
      playerId="player1"
    >
      <ActiveGame />
    </TestContext>
  );

  const previousRound = component.getByText(/Previous/);
  const playerCard = component.getByTestId("player-card-player1");

  expect(previousRound.compareDocumentPosition(playerCard) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  expect(
    component.getByText((_, element) => element?.textContent === "Score: 3 points")
  ).toBeTruthy();
});

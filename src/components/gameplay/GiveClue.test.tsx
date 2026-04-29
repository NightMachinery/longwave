import { render, fireEvent } from "@testing-library/react";
import { InitialGameState, RoundPhase, Team } from "../../state/GameState";
import { GiveClue } from "./GiveClue";
import { TestContext } from "./TestContext";

test("shows a clue-screen reroll button for moderators before any clue is submitted", () => {
  const submitAction = jest.fn();
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        roundPhase: RoundPhase.GiveClue,
        viewer: {
          ...InitialGameState().viewer,
          canManageRoom: true,
          isCurrentPsychic: false,
        },
        players: {
          mod1: {
            name: "Mod",
            team: Team.Unset,
            isModerator: true,
            isRepresentative: false,
            isObserver: false,
          },
        },
      }}
      playerId="mod1"
      submitAction={submitAction}
    >
      <GiveClue />
    </TestContext>
  );

  fireEvent.click(component.getByRole("button", { name: "Reroll prompt" }));

  expect(submitAction).toHaveBeenCalledWith({ type: "reroll_round" });
});

test("hides the clue-screen reroll button after a clue is submitted", () => {
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        roundPhase: RoundPhase.GiveClue,
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
          canManageRoom: true,
          isCurrentPsychic: false,
        },
        players: {
          mod1: {
            name: "Mod",
            team: Team.Unset,
            isModerator: true,
            isRepresentative: false,
            isObserver: false,
          },
        },
      }}
      playerId="mod1"
    >
      <GiveClue />
    </TestContext>
  );

  expect(component.queryByRole("button", { name: "Reroll prompt" })).toBeNull();
});

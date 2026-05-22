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
          canRerollRound: true,
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

  fireEvent.click(component.getByRole("button", { name: /Reroll prompt/ }));

  expect(submitAction).toHaveBeenCalledWith({ type: "reroll_round" });
  expect(component.getByRole("button", { name: "Reroll Target" })).toBeTruthy();
});

test("shows a moderator-only clue-screen target reroll button", () => {
  const submitAction = jest.fn();
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        roundPhase: RoundPhase.GiveClue,
        viewer: {
          ...InitialGameState().viewer,
          canManageRoom: true,
          canRerollRound: true,
          isCurrentPsychic: true,
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

  fireEvent.click(component.getByRole("button", { name: "Reroll Target" }));

  expect(submitAction).toHaveBeenCalledWith({ type: "reroll_target" });
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
          canRerollRound: false,
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

test("shows a clue-screen reroll button for psychics before any clue is submitted", () => {
  const submitAction = jest.fn();
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        roundPhase: RoundPhase.GiveClue,
        psychicIds: ["psychic1"],
        viewer: {
          ...InitialGameState().viewer,
          canRerollRound: true,
          canSubmitClue: true,
          isCurrentPsychic: true,
        },
        players: {
          psychic1: {
            name: "Psychic",
            team: Team.Unset,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
        },
      }}
      playerId="psychic1"
      submitAction={submitAction}
    >
      <GiveClue />
    </TestContext>
  );

  fireEvent.click(component.getByRole("button", { name: /Reroll prompt/ }));

  expect(submitAction).toHaveBeenCalledWith({ type: "reroll_round" });
  expect(component.queryByRole("button", { name: "Reroll Target" })).toBeNull();
});

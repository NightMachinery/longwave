import { render, fireEvent, within } from "@testing-library/react";
import { InitialGameState, Team } from "../../state/GameState";
import { JoinTeam } from "./JoinTeam";
import { TestContext } from "./TestContext";

test("dispatches join_team when selecting a team", async () => {
  const submitAction = jest.fn();
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        viewer: {
          ...InitialGameState().viewer,
          canChangeTeam: true,
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
      submitAction={submitAction}
    >
      <JoinTeam />
    </TestContext>
  );

  const leftBrain = await component.findByText("LEFT BRAIN");
  const button = within(leftBrain.parentElement!).getByRole("button", {
    name: "Join",
  });

  fireEvent.click(button);

  expect(submitAction).toHaveBeenCalledWith({
    type: "join_team",
    team: Team.Left,
  });
});

test("allows moderators to force-assign joined players to a team", async () => {
  const submitAction = jest.fn();
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        viewer: {
          ...InitialGameState().viewer,
          canChangeTeam: true,
          canManageRoom: true,
        },
        players: {
          mod1: {
            name: "Mod",
            team: Team.Left,
            isModerator: true,
            isRepresentative: false,
            isObserver: false,
          },
          player2: {
            name: "Player Two",
            team: Team.Unset,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
        },
      }}
      playerId="mod1"
      submitAction={submitAction}
    >
      <JoinTeam />
    </TestContext>
  );

  await component.findByText("Assign players");
  expect(component.getByText("Player Two — unassigned")).toBeTruthy();

  fireEvent.click(within(component.getByText("Player Two — unassigned").parentElement!).getByRole("button", { name: "Right" }));

  expect(submitAction).toHaveBeenCalledWith({
    type: "set_team",
    playerId: "player2",
    team: Team.Right,
  });
});

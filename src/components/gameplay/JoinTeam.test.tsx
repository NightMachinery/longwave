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

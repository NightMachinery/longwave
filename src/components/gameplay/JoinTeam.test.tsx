import { render, fireEvent, within } from "@testing-library/react";
import { InitialGameState, GameState, Team } from "../../state/GameState";
import { JoinTeam } from "./JoinTeam";
import { TestContext } from "./TestContext";

test("Assigns player to the selected team", async () => {
  const gameState: GameState = {
    ...InitialGameState(),
    players: {
      player1: {
        name: "Player",
        team: Team.Unset,
      },
    },
  };

  const setState = jest.fn();
  const component = await render(
    <TestContext gameState={gameState} playerId="player1" setState={setState}>
      <JoinTeam />
    </TestContext>
  );

  const leftBrain = await component.findByText("LEFT BRAIN");
  expect(leftBrain).not.toBeNull();

  const button = within(leftBrain.parentElement!).getByRole("button", {
    name: "Join",
  });

  await fireEvent.click(button);

  expect(setState).toHaveBeenCalledWith({
    players: {
      player1: {
        id: "player1",
        name: "Player",
        team: Team.Left,
      },
    },
  });
});

test("Shows current team members", () => {
  const gameState: GameState = {
    ...InitialGameState(),
    players: {
      playerId: {
        name: "Player",
        team: Team.Unset,
      },
      leftTeam1: {
        name: "Left Team 1",
        team: Team.Left,
      },
      leftTeam2: {
        name: "Left Team 2",
        team: Team.Left,
      },
      rightTeam1: {
        name: "Right Team 1",
        team: Team.Right,
      },
      rightTeam2: {
        name: "Right Team 2",
        team: Team.Right,
      },
    },
  };

  const component = render(
    <TestContext gameState={gameState} playerId="player1">
      <JoinTeam />
    </TestContext>
  );

  const leftBrain = within(component.getByText("LEFT BRAIN").parentElement!);
  expect(leftBrain.getByText("Left Team 1")).not.toBeNull();
  expect(leftBrain.getByText("Left Team 2")).not.toBeNull();

  const rightBrain = within(component.getByText("RIGHT BRAIN").parentElement!);
  expect(rightBrain.getByText("Right Team 1")).not.toBeNull();
  expect(rightBrain.getByText("Right Team 2")).not.toBeNull();
});

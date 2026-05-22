import { render, fireEvent, within } from "@testing-library/react";
import { GameType, InitialGameState, RoundPhase, Team } from "../../state/GameState";
import { JoinTeam } from "./JoinTeam";
import { TestContext } from "./TestContext";
import { PlayerManagementCard } from "./PlayerManagement";

test("dispatches join_team when selecting a team", async () => {
  const submitAction = vi.fn();
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

test("shows randomize team controls for moderators during team setup", async () => {
  const submitAction = vi.fn();
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        gameType: GameType.Teams,
        roundPhase: RoundPhase.PickTeams,
        randomizeTeams: true,
        viewer: {
          ...InitialGameState().viewer,
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
        },
      }}
      playerId="mod1"
      submitAction={submitAction}
    >
      <JoinTeam />
    </TestContext>
  );

  fireEvent.click(component.getByRole("checkbox", { name: "Randomize player assignments" }));
  expect(submitAction).toHaveBeenCalledWith({
    type: "set_randomize_teams",
    value: false,
  });

  fireEvent.click(component.getByRole("button", { name: "Randomize Teams" }));
  expect(submitAction).toHaveBeenCalledWith({ type: "randomize_teams" });
});

test("shows previous game result during team setup", () => {
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        gameType: GameType.Teams,
        roundPhase: RoundPhase.PickTeams,
        previousGameResult: {
          gameType: GameType.Teams,
          winnerTeam: Team.Left,
          loserTeam: Team.Right,
          leftScore: 10,
          rightScore: 7,
          coopScore: 0,
        },
        players: {
          player1: {
            name: "Player",
            team: Team.Left,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
        },
      }}
      playerId="player1"
    >
      <JoinTeam />
    </TestContext>
  );

  expect(component.getByText("LEFT BRAIN beat RIGHT BRAIN, 10-7.")).toBeTruthy();
});

test("allows moderators to force-assign joined players to a team", async () => {
  const submitAction = vi.fn();
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

  await component.findByText("Manage players");
  expect(component.getByText("Player Two")).toBeTruthy();

  fireEvent.click(
    within(component.getByTestId("player-card-player2")).getByRole("button", {
      name: "RIGHT BRAIN",
    })
  );

  expect(submitAction).toHaveBeenCalledWith({
    type: "set_team",
    playerId: "player2",
    team: Team.Right,
  });
});

test("allows moderators to manage themselves without showing self moderator controls", async () => {
  const submitAction = vi.fn();
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        viewer: {
          ...InitialGameState().viewer,
          canChangeTeam: true,
          canManageRoom: true,
        },
        creatorId: "mod1",
        players: {
          mod1: {
            name: "Mod",
            team: Team.Left,
            isModerator: true,
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

  await component.findByText("Manage players");
  fireEvent.click(
    within(component.getByTestId("player-card-mod1")).getByRole("button", {
      name: "Make rep",
    })
  );

  expect(submitAction).toHaveBeenCalledWith({
    type: "set_representative",
    playerId: "mod1",
    value: true,
  });
  expect(
    within(component.getByTestId("player-card-mod1")).queryByRole("button", {
      name: "Demote mod",
    })
  ).toBeNull();
});

test("allows observer players to rejoin themselves", async () => {
  const submitAction = vi.fn();
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        players: {
          player1: {
            name: "Player",
            team: Team.Left,
            isModerator: false,
            isRepresentative: false,
            isObserver: true,
          },
        },
      }}
      playerId="player1"
      submitAction={submitAction}
    >
      <PlayerManagementCard playerId="player1" submitAction={submitAction} />
    </TestContext>
  );

  fireEvent.click(
    within(component.getByTestId("player-card-player1")).getByRole("button", {
      name: "Rejoin",
    })
  );

  expect(submitAction).toHaveBeenCalledWith({
    type: "set_observer",
    playerId: "player1",
    value: false,
  });
});

test("shows individual marker color on active Individual player cards only", () => {
  const submitAction = vi.fn();
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        gameType: GameType.Individual,
        players: {
          player1: {
            name: "Player",
            team: Team.Unset,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
          observer1: {
            name: "Observer",
            team: Team.Unset,
            isModerator: false,
            isRepresentative: false,
            isObserver: true,
          },
        },
      }}
      playerId="player1"
      submitAction={submitAction}
    >
      <>
        <PlayerManagementCard playerId="player1" submitAction={submitAction} />
        <PlayerManagementCard playerId="observer1" submitAction={submitAction} />
      </>
    </TestContext>
  );

  expect(component.getByLabelText("Player marker color").style.backgroundColor).not.toBe("");
  expect(component.queryByLabelText("Observer marker color")).toBeNull();
});

test("shows a pending guess ring on Individual player cards during guessing", () => {
  const submitAction = vi.fn();
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        gameType: GameType.Individual,
        roundPhase: RoundPhase.MakeGuess,
        psychicIds: ["psychic1"],
        individualGuesses: {
          submitted1: -1,
        },
        players: {
          player1: {
            name: "Player",
            team: Team.Unset,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
          submitted1: {
            name: "Submitted",
            team: Team.Unset,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
          psychic1: {
            name: "Psychic",
            team: Team.Unset,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
          observer1: {
            name: "Observer",
            team: Team.Unset,
            isModerator: false,
            isRepresentative: false,
            isObserver: true,
          },
        },
      }}
      playerId="player1"
      submitAction={submitAction}
    >
      <>
        <PlayerManagementCard playerId="player1" submitAction={submitAction} />
        <PlayerManagementCard playerId="submitted1" submitAction={submitAction} />
        <PlayerManagementCard playerId="psychic1" submitAction={submitAction} />
        <PlayerManagementCard playerId="observer1" submitAction={submitAction} />
      </>
    </TestContext>
  );

  const pendingMarker = component.getByLabelText("Player needs to guess");
  expect(pendingMarker.style.backgroundColor).toBe("rgb(220, 38, 38)");
  expect((pendingMarker.children[0] as HTMLElement).style.backgroundColor).toBe(
    "rgb(255, 255, 255)"
  );
  expect(
    ((pendingMarker.children[0] as HTMLElement).children[0] as HTMLElement).style.backgroundColor
  ).not.toBe("");
  expect(component.queryByLabelText("Submitted needs to guess")).toBeNull();
  expect(component.getByLabelText("Submitted marker color")).toBeTruthy();
  expect(component.queryByLabelText("Psychic needs to guess")).toBeNull();
  expect(component.getByLabelText("Psychic marker color")).toBeTruthy();
  expect(component.queryByLabelText("Observer needs to guess")).toBeNull();
  expect(component.queryByLabelText("Observer marker color")).toBeNull();
});

test("does not show individual marker color on non-Individual player cards", () => {
  const submitAction = vi.fn();
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        gameType: GameType.Teams,
        players: {
          player1: {
            name: "Player",
            team: Team.Left,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
        },
      }}
      playerId="player1"
      submitAction={submitAction}
    >
      <PlayerManagementCard playerId="player1" submitAction={submitAction} />
    </TestContext>
  );

  expect(component.queryByLabelText("Player marker color")).toBeNull();
});

test("shows mid-game team controls for non-psychics but not current psychics", () => {
  const submitAction = vi.fn();
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        gameType: GameType.Teams,
        roundPhase: RoundPhase.GiveClue,
        psychicIds: ["psychic1"],
        viewer: {
          ...InitialGameState().viewer,
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
            team: Team.Left,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
          psychic1: {
            name: "Psychic",
            team: Team.Left,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
        },
      }}
      playerId="mod1"
      submitAction={submitAction}
    >
      <>
        <PlayerManagementCard playerId="player2" submitAction={submitAction} />
        <PlayerManagementCard playerId="psychic1" submitAction={submitAction} />
      </>
    </TestContext>
  );

  fireEvent.click(
    within(component.getByTestId("player-card-player2")).getByRole("button", {
      name: "RIGHT BRAIN",
    })
  );
  expect(submitAction).toHaveBeenCalledWith({
    type: "set_team",
    playerId: "player2",
    team: Team.Right,
  });
  expect(
    within(component.getByTestId("player-card-psychic1")).queryByRole("button", {
      name: "RIGHT BRAIN",
    })
  ).toBeNull();
});

test("shows temporary representative badges for other players", () => {
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        viewer: {
          ...InitialGameState().viewer,
          playerId: "mod1",
          temporaryRepIds: ["player2"],
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
            team: Team.Left,
            isModerator: false,
            isRepresentative: false,
            isObserver: false,
          },
        },
      }}
      playerId="mod1"
    >
      <PlayerManagementCard playerId="player2" submitAction={vi.fn()} />
    </TestContext>
  );

  expect(within(component.getByTestId("player-card-player2")).getByText("Temporary rep")).toBeTruthy();
});

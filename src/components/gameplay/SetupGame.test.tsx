import { fireEvent, render, waitFor } from "@testing-library/react";
import { GameType, InitialGameState } from "../../state/GameState";
import { fetchWordpacks } from "../../network/roomApi";
import { SetupGame } from "./SetupGame";
import { TestContext } from "./TestContext";

vi.mock("../../network/roomApi", () => ({
  fetchWordpacks: vi.fn(),
}));

const mockedFetchWordpacks = vi.mocked(fetchWordpacks);

describe("SetupGame", () => {
  beforeEach(() => {
    mockedFetchWordpacks.mockResolvedValue([
      { id: "English", name: "English" },
      { id: "Persian", name: "Persian" },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lets moderators choose multiple room wordpacks before mode selection", async () => {
    const submitAction = vi.fn();
    const component = render(
      <TestContext
        gameState={{
          ...InitialGameState(),
          viewer: {
            ...InitialGameState().viewer,
            canManageRoom: true,
          },
          players: {
            mod1: {
              name: "Mod",
              team: 0,
              isModerator: true,
              isRepresentative: false,
              isObserver: false,
            },
          },
        }}
        playerId="mod1"
        submitAction={submitAction}
      >
        <SetupGame />
      </TestContext>
    );

    await waitFor(() => expect(mockedFetchWordpacks).toHaveBeenCalled());

    fireEvent.click(component.getByLabelText("Persian"));

    expect(submitAction).toHaveBeenCalledWith({
      type: "set_wordpacks",
      wordpacks: ["English", "Persian"],
    });
  });

  it("lets moderators double-click a wordpack to select only that wordpack", async () => {
    const submitAction = vi.fn();
    const component = render(
      <TestContext
        gameState={{
          ...InitialGameState(),
          wordpacks: ["English", "Persian"],
          viewer: {
            ...InitialGameState().viewer,
            canManageRoom: true,
          },
          players: {
            mod1: {
              name: "Mod",
              team: 0,
              isModerator: true,
              isRepresentative: false,
              isObserver: false,
            },
          },
        }}
        playerId="mod1"
        submitAction={submitAction}
      >
        <SetupGame />
      </TestContext>
    );

    await waitFor(() => expect(mockedFetchWordpacks).toHaveBeenCalled());

    fireEvent.doubleClick(component.getByText("Persian"));

    expect(submitAction).toHaveBeenCalledWith({
      type: "set_wordpacks",
      wordpacks: ["Persian"],
    });
  });

  it("lets moderators choose Individual mode", async () => {
    const submitAction = vi.fn();
    const component = render(
      <TestContext
        gameState={{
          ...InitialGameState(),
          viewer: {
            ...InitialGameState().viewer,
            canManageRoom: true,
          },
          players: {
            mod1: {
              name: "Mod",
              team: 0,
              isModerator: true,
              isRepresentative: false,
              isObserver: false,
            },
          },
        }}
        playerId="mod1"
        submitAction={submitAction}
      >
        <SetupGame />
      </TestContext>
    );

    await waitFor(() => expect(mockedFetchWordpacks).toHaveBeenCalled());

    component.getByRole("button", { name: "Individual: 2+ Players" }).click();

    expect(submitAction).toHaveBeenCalledWith({
      type: "set_game_type",
      gameType: GameType.Individual,
    });
  });
});

import { fireEvent, render, waitFor } from "@testing-library/react";
import { InitialGameState } from "../../state/GameState";
import { fetchWordpacks } from "../../network/roomApi";
import { SetupGame } from "./SetupGame";
import { TestContext } from "./TestContext";

jest.mock("../../network/roomApi", () => ({
  fetchWordpacks: jest.fn(),
}));

const mockedFetchWordpacks = fetchWordpacks as jest.MockedFunction<
  typeof fetchWordpacks
>;

describe("SetupGame", () => {
  beforeEach(() => {
    mockedFetchWordpacks.mockResolvedValue([
      { id: "English", name: "English" },
      { id: "Persian", name: "Persian" },
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("lets moderators choose the room wordpack before mode selection", async () => {
    const submitAction = jest.fn();
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

    fireEvent.change(component.getByLabelText("Wordpack"), {
      target: { value: "Persian" },
    });

    expect(submitAction).toHaveBeenCalledWith({
      type: "set_wordpack",
      wordpack: "Persian",
    });
  });
});

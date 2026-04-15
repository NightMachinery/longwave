import { fireEvent, render, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "../gameplay/i18nForTests";
import { GameModelContext } from "../../state/GameModelContext";
import { InitialGameState, Team } from "../../state/GameState";
import { RoomMenu } from "./RoomIdHeader";
import { copyTextToClipboard } from "../../utils/copyTextToClipboard";

jest.mock("../../utils/copyTextToClipboard", () => ({
  copyTextToClipboard: jest.fn(),
}));

describe("RoomMenu", () => {
  const mockedCopyTextToClipboard = copyTextToClipboard as jest.MockedFunction<
    typeof copyTextToClipboard
  >;

  beforeEach(() => {
    mockedCopyTextToClipboard.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, "", "/");
  });

  function renderRoomMenu() {
    return render(
      <GameModelContext.Provider
        value={{
          gameState: InitialGameState("en"),
          localPlayer: {
            id: "player-id",
            name: "Player",
            team: Team.Unset,
          },
          clueGiver: null,
          spectrumCard: ["left", "right"],
          setGameState: jest.fn(),
          setPlayerName: jest.fn(),
        }}
      >
        <Suspense fallback={<div>Loading...</div>}>
          <I18nextProvider i18n={i18n}>
            <RoomMenu roomId="ROOM" />
          </I18nextProvider>
        </Suspense>
      </GameModelContext.Provider>
    );
  }

  it("copies the canonical room url without migration parameters", async () => {
    window.history.replaceState({}, "", "/ROOM?roomAuth=shared-room-auth");
    const component = renderRoomMenu();

    fireEvent.click(component.getByText("Copy room link"));

    await waitFor(() => {
      expect(mockedCopyTextToClipboard).toHaveBeenCalledWith(
        "http://localhost/ROOM"
      );
    });
    expect(component.getByText("Room link copied.")).not.toBeNull();
  });

  it("copies a migrated room url using the active room auth id", async () => {
    window.history.replaceState({}, "", "/ROOM?roomAuth=shared-room-auth");
    const component = renderRoomMenu();

    fireEvent.click(component.getByText("Migrate device"));

    await waitFor(() => {
      expect(mockedCopyTextToClipboard).toHaveBeenCalledWith(
        "http://localhost/ROOM?roomAuth=shared-room-auth"
      );
    });
    expect(component.getByText("Migration link copied.")).not.toBeNull();
  });
});

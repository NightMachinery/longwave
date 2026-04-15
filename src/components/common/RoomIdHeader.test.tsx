import { fireEvent, render, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "../gameplay/i18nForTests";
import { GameModelContext } from "../../state/GameModelContext";
import { InitialGameState, Team } from "../../state/GameState";
import { RoomMenu } from "./RoomIdHeader";
import { copyTextToClipboard } from "../../utils/copyTextToClipboard";
import { requestMigrationLink } from "../../network/roomApi";

jest.mock("../../utils/copyTextToClipboard", () => ({
  copyTextToClipboard: jest.fn(),
}));

jest.mock("../../network/roomApi", () => ({
  requestMigrationLink: jest.fn(),
}));

describe("RoomMenu", () => {
  const mockedCopyTextToClipboard = copyTextToClipboard as jest.MockedFunction<
    typeof copyTextToClipboard
  >;
  const mockedRequestMigrationLink = requestMigrationLink as jest.MockedFunction<
    typeof requestMigrationLink
  >;

  beforeEach(() => {
    mockedCopyTextToClipboard.mockResolvedValue(true);
    mockedRequestMigrationLink.mockResolvedValue("http://localhost/ROOM?migrate=abc123");
  });

  afterEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, "", "/");
  });

  function renderRoomMenu() {
    return render(
      <GameModelContext.Provider
        value={{
          gameState: {
            ...InitialGameState("en"),
            viewer: {
              ...InitialGameState("en").viewer,
              playerId: "player-id",
              canManageRoom: true,
            },
            players: {
              "player-id": {
                name: "Player",
                team: Team.Unset,
                isModerator: true,
                isRepresentative: false,
                isObserver: false,
              },
            },
          },
          localPlayer: {
            id: "player-id",
            name: "Player",
            team: Team.Unset,
            isModerator: true,
            isRepresentative: false,
            isObserver: false,
          },
          psychics: [],
          spectrumCard: ["left", "right"],
          previousSpectrumCard: null,
          submitAction: jest.fn(),
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
    const component = renderRoomMenu();

    fireEvent.click(component.getByText("Copy room link"));

    await waitFor(() => {
      expect(mockedCopyTextToClipboard).toHaveBeenCalledWith(
        "http://localhost/ROOM"
      );
    });
  });

  it("copies a migrated room url using the server-generated token", async () => {
    const component = renderRoomMenu();

    fireEvent.click(component.getByText("Migrate device"));

    await waitFor(() => {
      expect(mockedRequestMigrationLink).toHaveBeenCalledWith("ROOM");
      expect(mockedCopyTextToClipboard).toHaveBeenCalledWith(
        "http://localhost/ROOM?migrate=abc123"
      );
    });
  });
});

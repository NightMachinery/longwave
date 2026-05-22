import { fireEvent, render, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "../gameplay/i18nForTests";
import { GameModelContext } from "../../state/GameModelContext";
import { GameType, InitialGameState, RoundPhase, Team } from "../../state/GameState";
import { RoomMenu } from "./RoomIdHeader";
import { copyTextToClipboard } from "../../utils/copyTextToClipboard";
import { fetchWordpacks, requestMigrationLink } from "../../network/roomApi";
import { hintSoundEffectsKey, hintVisualEffectsKey } from "../../utils/localPreferences";

jest.mock("../../utils/copyTextToClipboard", () => ({
  copyTextToClipboard: jest.fn(),
}));

jest.mock("../../network/roomApi", () => ({
  requestMigrationLink: jest.fn(),
  fetchWordpacks: jest.fn(),
}));

describe("RoomMenu", () => {
  const mockedCopyTextToClipboard = copyTextToClipboard as jest.MockedFunction<
    typeof copyTextToClipboard
  >;
  const mockedRequestMigrationLink = requestMigrationLink as jest.MockedFunction<
    typeof requestMigrationLink
  >;
  const mockedFetchWordpacks = fetchWordpacks as jest.MockedFunction<
    typeof fetchWordpacks
  >;

  beforeEach(() => {
    localStorage.clear();
    mockedCopyTextToClipboard.mockResolvedValue(true);
    mockedRequestMigrationLink.mockResolvedValue("http://localhost/ROOM?migrate=abc123");
    mockedFetchWordpacks.mockResolvedValue([
      { id: "English", name: "English" },
      { id: "Persian", name: "Persian" },
    ]);
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
              canRerollRound: true,
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
          spectrumCard: { left: { text: "left" }, right: { text: "right" } },
          previousSpectrumCard: null,
          submitAction: jest.fn(),
          openNameEditor: jest.fn(),
        }}
      >
        <Suspense fallback={<div>Loading...</div>}>
          <I18nextProvider i18n={i18n}>
            <RoomMenu
              roomId="ROOM"
              canonicalRoomUrl="http://localhost/ROOM"
              showCopyNotice={async (text) => {
                await copyTextToClipboard(text);
              }}
              showNotice={jest.fn()}
            />
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

  it("opens game settings and changes the wordpack", async () => {
    const submitAction = jest.fn();
    const component = render(
      <GameModelContext.Provider
        value={{
          gameState: {
            ...InitialGameState("en"),
            wordpack: "English",
            wordpacks: ["English"],
            viewer: {
              ...InitialGameState("en").viewer,
              playerId: "player-id",
              canManageRoom: true,
              canRerollRound: true,
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
          spectrumCard: { left: { text: "left" }, right: { text: "right" } },
          previousSpectrumCard: null,
          submitAction,
          openNameEditor: jest.fn(),
        }}
      >
        <Suspense fallback={<div>Loading...</div>}>
          <I18nextProvider i18n={i18n}>
            <RoomMenu
              roomId="ROOM"
              canonicalRoomUrl="http://localhost/ROOM"
              showCopyNotice={async () => {}}
              showNotice={jest.fn()}
            />
          </I18nextProvider>
        </Suspense>
      </GameModelContext.Provider>
    );

    fireEvent.click(component.getByText("Game settings"));
    await waitFor(() => expect(mockedFetchWordpacks).toHaveBeenCalled());
    fireEvent.click(component.getByLabelText("Persian"));

    expect(submitAction).toHaveBeenCalledWith({
      type: "set_wordpacks",
      wordpacks: ["English", "Persian"],
    });
  });

  it("lets moderators toggle individual live guess visibility", () => {
    const submitAction = jest.fn();
    const component = render(
      <GameModelContext.Provider
        value={{
          gameState: {
            ...InitialGameState("en"),
            gameType: GameType.Individual,
            individualClueGiverCanSeeLiveGuesses: true,
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
          spectrumCard: { left: { text: "left" }, right: { text: "right" } },
          previousSpectrumCard: null,
          submitAction,
          openNameEditor: jest.fn(),
        }}
      >
        <Suspense fallback={<div>Loading...</div>}>
          <I18nextProvider i18n={i18n}>
            <RoomMenu
              roomId="ROOM"
              canonicalRoomUrl="http://localhost/ROOM"
              showCopyNotice={async () => {}}
              showNotice={jest.fn()}
            />
          </I18nextProvider>
        </Suspense>
      </GameModelContext.Provider>
    );

    fireEvent.click(component.getByText("Game settings"));
    fireEvent.click(component.getByLabelText("Clue givers see players guessing in real-time"));

    expect(submitAction).toHaveBeenCalledWith({
      type: "set_individual_live_guesses",
      individualClueGiverCanSeeLiveGuesses: false,
    });
  });

  it("shows reroll prompt only before clues are submitted", () => {
    const component = render(
      <GameModelContext.Provider
        value={{
          gameState: {
            ...InitialGameState("en"),
            roundPhase: RoundPhase.GiveClue,
            viewer: {
              ...InitialGameState("en").viewer,
              playerId: "player-id",
              canManageRoom: true,
              canRerollRound: true,
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
          spectrumCard: { left: { text: "left" }, right: { text: "right" } },
          previousSpectrumCard: null,
          submitAction: jest.fn(),
          openNameEditor: jest.fn(),
        }}
      >
        <Suspense fallback={<div>Loading...</div>}>
          <I18nextProvider i18n={i18n}>
            <RoomMenu
              roomId="ROOM"
              canonicalRoomUrl="http://localhost/ROOM"
              showCopyNotice={async () => {}}
              showNotice={jest.fn()}
            />
          </I18nextProvider>
        </Suspense>
      </GameModelContext.Provider>
    );

    expect(component.getByText("Reroll prompt")).toBeTruthy();
  });

  it("persists local hint effect preferences", () => {
    const component = renderRoomMenu();

    expect((component.getByLabelText("Hint visual effects") as HTMLInputElement).checked).toBe(true);
    expect((component.getByLabelText("Hint sound effects") as HTMLInputElement).checked).toBe(true);

    fireEvent.click(component.getByLabelText("Hint visual effects"));
    fireEvent.click(component.getByLabelText("Hint sound effects"));

    expect(localStorage.getItem(hintVisualEffectsKey)).toBe("false");
    expect(localStorage.getItem(hintSoundEffectsKey)).toBe("false");
  });
});

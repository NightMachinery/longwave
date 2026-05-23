import { Team, InitialGameState } from "./GameState";
import { createContext } from "react";
import { GameModel } from "./BuildGameModel";
import { fallbackWordpackCards } from "./Wordpack";

export const GameModelContext = createContext<GameModel>({
  gameState: InitialGameState("en"),
  localPlayer: {
    id: "localPlayer",
    name: "Player",
    team: Team.Unset,
    isModerator: false,
    isRepresentative: false,
    isObserver: false,
  },
  psychics: [],
  spectrumCard: fallbackWordpackCards[0],
  previousSpectrumCard: null,
  roomAuth: {},
  submitAction: (action) => {
    console.warn(
      "GameModelContext not provided. Got submitAction: " +
        JSON.stringify(action)
    );
  },
  openNameEditor: () => {},
});

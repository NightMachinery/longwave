import { Team, InitialGameState } from "./GameState";
import { createContext } from "react";
import { GameModel } from "./BuildGameModel";

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
  spectrumCard: ["left", "right"],
  previousSpectrumCard: null,
  submitAction: (action) => {
    console.warn(
      "GameModelContext not provided. Got submitAction: " +
        JSON.stringify(action)
    );
  },
  openNameEditor: () => {},
});

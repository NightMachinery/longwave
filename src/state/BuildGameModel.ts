import { GameState, Team } from "./GameState";
import memoize from "lodash/memoize";
import { TFunction } from "i18next";
import { RoomAction } from "../network/roomApi";

const shuffleSeed: {
  shuffle: <T>(arr: T[], seed: string) => T[];
} = require("shuffle-seed");

type Player = {
  id: string;
  name: string;
  team: Team;
  isModerator: boolean;
  isRepresentative: boolean;
  isObserver: boolean;
};

export interface GameModel {
  gameState: GameState;
  localPlayer: Player;
  psychics: Player[];
  spectrumCard: [string, string];
  previousSpectrumCard: [string, string] | null;
  submitAction: (action: RoomAction) => void;
  openNameEditor: () => void;
}

const getSeededDeck = memoize((seed: string, cards: [string, string][]) =>
  shuffleSeed.shuffle(cards, seed)
);

function getCardAtIndex(
  seed: string,
  deckIndex: number,
  tSpectrumCards: TFunction<"spectrum-cards">
): [string, string] {
  type SpectrumCard = [string, string];
  const basicCards = tSpectrumCards("basic", {
    returnObjects: true,
  }) as SpectrumCard[];
  const advancedCards = tSpectrumCards("advanced", {
    returnObjects: true,
  }) as SpectrumCard[];
  const allCards = [...basicCards, ...advancedCards];
  const spectrumDeck = getSeededDeck(seed, allCards);
  return spectrumDeck[deckIndex % spectrumDeck.length];
}

export function BuildGameModel(
  gameState: GameState,
  submitAction: (action: RoomAction) => void,
  tSpectrumCards: TFunction<"spectrum-cards">,
  openNameEditor: () => void
): GameModel {
  const players = gameState.players ?? {};
  const psychicIds = gameState.psychicIds ?? [];

  const localPlayerState = players[gameState.viewer.playerId] || {
    name: "Player",
    team: Team.Unset,
    isModerator: false,
    isRepresentative: false,
    isObserver: false,
  };
  const localPlayer: Player = {
    id: gameState.viewer.playerId,
    ...localPlayerState,
  };

  return {
    gameState,
    localPlayer,
    psychics: psychicIds
      .map((id) =>
        players[id]
          ? {
              id,
              ...players[id],
            }
          : null
      )
      .filter((player): player is Player => player !== null),
    spectrumCard: getCardAtIndex(
      gameState.deckSeed,
      gameState.deckIndex,
      tSpectrumCards
    ),
    previousSpectrumCard:
      gameState.previousTurn === null
        ? null
        : getCardAtIndex(
            gameState.deckSeed,
            gameState.previousTurn.deckIndex,
            tSpectrumCards
          ),
    submitAction,
    openNameEditor,
  };
}

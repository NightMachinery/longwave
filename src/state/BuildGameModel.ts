import { GameState, Team } from "./GameState";
import { RoomAction } from "../network/roomApi";
import { fallbackWordpackCards, WordpackCard } from "./Wordpack";

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
  spectrumCard: WordpackCard;
  previousSpectrumCard: WordpackCard | null;
  submitAction: (action: RoomAction) => void;
  openNameEditor: () => void;
}

function getSeededDeck(seed: string, cards: WordpackCard[]): WordpackCard[] {
  return shuffleSeed.shuffle(cards, seed);
}

function getCardAtIndex(
  seed: string,
  deckIndex: number,
  cards: WordpackCard[]
): WordpackCard {
  const allCards = cards.length > 0 ? cards : fallbackWordpackCards;
  const spectrumDeck = getSeededDeck(seed, allCards);
  return spectrumDeck[deckIndex % spectrumDeck.length];
}

export function BuildGameModel(
  gameState: GameState,
  submitAction: (action: RoomAction) => void,
  wordpackCards: WordpackCard[],
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
      wordpackCards
    ),
    previousSpectrumCard:
      gameState.previousTurn === null
        ? null
        : getCardAtIndex(
            gameState.deckSeed,
            gameState.previousTurn.deckIndex,
            wordpackCards
          ),
    submitAction,
    openNameEditor,
  };
}

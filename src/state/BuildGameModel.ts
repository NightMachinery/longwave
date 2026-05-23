import { GameState, Team } from "./GameState";
import { RoomAction, RoomAuth } from "../network/roomApi";
import { fallbackWordpackCards, WordpackCard } from "./Wordpack";

const seedrandom: (seed: string) => () => number = require("seedrandom");

type Player = {
  id: string;
  name: string;
  displayName?: string;
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
  roomAuth?: RoomAuth;
  submitAction: (action: RoomAction) => void;
  openNameEditor: () => void;
}

function getSeededDeck(seed: string, cards: WordpackCard[]): WordpackCard[] {
  const rng = seedrandom(seed || "none");
  const remainingIndexes = cards.map((_, index) => index);
  const shuffledCards: WordpackCard[] = [];

  for (let index = 0; index < cards.length; index += 1) {
    const remainingIndex = Math.floor(rng() * remainingIndexes.length);
    const cardIndex = remainingIndexes[remainingIndex];
    remainingIndexes.splice(remainingIndex, 1);
    shuffledCards.push(cards[cardIndex]);
  }

  return shuffledCards;
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
  openNameEditor: () => void,
  roomAuth: RoomAuth = {}
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
    spectrumCard:
      gameState.currentPrompt ??
      getCardAtIndex(
        gameState.deckSeed,
        gameState.deckIndex,
        wordpackCards
      ),
    previousSpectrumCard:
      gameState.previousTurn === null
        ? null
        : gameState.previousTurn.prompt ??
          getCardAtIndex(
              gameState.deckSeed,
              gameState.previousTurn.deckIndex,
              wordpackCards
            ),
    roomAuth,
    submitAction,
    openNameEditor,
  };
}

import { GameState } from "./GameState";

export function NewRound(_playerId: string, gameState: GameState): Partial<GameState> {
  return {
    deckIndex: gameState.deckIndex + 1,
  };
}

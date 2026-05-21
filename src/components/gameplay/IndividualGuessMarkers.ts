import { SpectrumDotMarker } from "../common/Spectrum";
import { PlayerState } from "../../state/GameState";

export function buildIndividualGuessMarkers(
  guesses: Record<string, number>,
  players: Record<string, PlayerState>
): SpectrumDotMarker[] {
  return Object.keys(guesses)
    .filter((playerId) => {
      const guess = guesses[playerId];
      return guess >= 0 && players[playerId] !== undefined && !players[playerId].isObserver;
    })
    .map((playerId) => ({
      playerId,
      name: players[playerId].name,
      value: guesses[playerId],
      color: playerMarkerColor(playerId),
    }));
}

function playerMarkerColor(playerId: string) {
  const palette = [
    "#0ea5e9",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#14b8a6",
    "#ec4899",
    "#84cc16",
    "#6366f1",
    "#f97316",
  ];
  return palette[Math.abs(hashString(playerId)) % palette.length];
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

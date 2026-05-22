import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { RoundPhase, GameType, Team } from "../../state/GameState";
import { GiveClue } from "./GiveClue";
import { MakeGuess } from "./MakeGuess";
import { ViewScore } from "./ViewScore";
import { JoinTeam } from "./JoinTeam";
import { Scoreboard } from "./Scoreboard";
import { SetupGame } from "./SetupGame";
import { CounterGuess } from "./CounterGuess";
import { GameModelContext } from "../../state/GameModelContext";
import { PreviousTurnResult } from "./PreviousTurnResult";
import { ReadyLobby } from "./ReadyLobby";
import { useBooleanPreference } from "../hooks/useBooleanPreference";
import { hintSoundEffectsKey, hintVisualEffectsKey } from "../../utils/localPreferences";

export function ActiveGame() {
  const { gameState, localPlayer } = useContext(GameModelContext);
  const [hintVisualEffects] = useBooleanPreference(hintVisualEffectsKey, true);
  const [hintSoundEffects] = useBooleanPreference(hintSoundEffectsKey, true);
  const hintEffectKey = useHintEffects(
    gameState.clues.map((clue) => `${clue.authorId}:${clue.order}:${clue.text}`),
    hintVisualEffects,
    hintSoundEffects
  );

  if (gameState.roundPhase === RoundPhase.SetupGame) {
    return <SetupGame />;
  }

  if (gameState.roundPhase === RoundPhase.Ready) {
    return <ReadyLobby />;
  }

  if (
    gameState.gameType === GameType.Teams &&
    !localPlayer.isObserver &&
    (gameState.roundPhase === RoundPhase.PickTeams || localPlayer.team === Team.Unset)
  ) {
    return <JoinTeam />;
  }

  return (
    <>
      {hintVisualEffects && hintEffectKey > 0 && (
        <div key={hintEffectKey} className="hint-arrival-effect" aria-hidden="true" />
      )}
      {gameState.roundPhase === RoundPhase.PickTeams && <JoinTeam />}
      {gameState.roundPhase === RoundPhase.GiveClue && <GiveClue />}
      {gameState.roundPhase === RoundPhase.MakeGuess && <MakeGuess />}
      {gameState.roundPhase === RoundPhase.CounterGuess && <CounterGuess />}
      {gameState.roundPhase === RoundPhase.ViewScore && <ViewScore />}
      <Scoreboard />
      {gameState.previousTurn && <PreviousTurnResult {...gameState.previousTurn} />}
    </>
  );
}

function useHintEffects(visibleClueKeys: string[], visualEnabled: boolean, soundEnabled: boolean) {
  const previousClueCountRef = useRef(visibleClueKeys.length);
  const didMountRef = useRef(false);
  const [effectKey, setEffectKey] = useState(0);
  const clueSignature = useMemo(() => visibleClueKeys.join("|"), [visibleClueKeys]);

  useEffect(() => {
    const previousClueCount = previousClueCountRef.current;
    previousClueCountRef.current = visibleClueKeys.length;
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (visibleClueKeys.length <= previousClueCount) {
      return;
    }
    if (visualEnabled) {
      setEffectKey((value) => value + 1);
    }
    if (soundEnabled) {
      playHintSound();
    }
  }, [clueSignature, soundEnabled, visualEnabled, visibleClueKeys.length]);

  return effectKey;
}

function playHintSound() {
  const AudioContextConstructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    return;
  }
  try {
    const context = new AudioContextConstructor();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 659.25;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
    window.setTimeout(() => {
      void context.close();
    }, 260);
  } catch (error) {
    // Browsers may block audio until a user gesture allows playback.
  }
}

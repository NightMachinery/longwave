import { ReactChild, Suspense } from "react";
import { GameState, InitialGameState } from "../../state/GameState";
import { BuildGameModel } from "../../state/BuildGameModel";
import { GameModelContext } from "../../state/GameModelContext";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18nForTests";
import { RoomAction } from "../../network/roomApi";
import { fallbackWordpackCards } from "../../state/Wordpack";


export function TestContext(props: {
  gameState: Partial<GameState>;
  playerId: string;
  children: ReactChild;
  submitAction?: (action: RoomAction) => void;
}) {
  const mergedGameState: GameState = {
    ...InitialGameState("en"),
    ...props.gameState,
    viewer: {
      ...InitialGameState("en").viewer,
      ...props.gameState.viewer,
      playerId: props.playerId,
    },
  };

  return (
    <GameModelContext.Provider
      value={BuildGameModel(
        mergedGameState,
        props.submitAction || vi.fn(),
        fallbackWordpackCards,
        () => {}
      )}
    >
      <Suspense fallback={<div>Loading...</div>}>
        <I18nextProvider i18n={i18n}>{props.children}</I18nextProvider>
      </Suspense>
    </GameModelContext.Provider>
  );
}

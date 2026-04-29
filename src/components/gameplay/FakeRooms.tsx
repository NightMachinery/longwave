import React, { useState } from "react";
import { GameModelContext } from "../../state/GameModelContext";
import { ActiveGame } from "./ActiveGame";
import { BuildGameModel } from "../../state/BuildGameModel";
import { CenteredRow, CenteredColumn } from "../common/LayoutElements";
import {
  InitialGameState,
  GameState,
  Team,
  GameType,
  RoundPhase,
} from "../../state/GameState";
import { RoomAction } from "../../network/roomApi";
import { fallbackWordpackCards } from "../../state/Wordpack";

export function FakeRooms() {
  const [gameState, setGameState] = useState<GameState>({
    ...InitialGameState(),
    gameType: GameType.Teams,
    roundPhase: RoundPhase.PickTeams,
    viewer: {
      ...InitialGameState().viewer,
      playerId: "ul",
      canManageRoom: true,
      canChangeTeam: true,
    },
    players: {
      ul: {
        name: "Upper Left",
        team: Team.Left,
        isModerator: true,
        isRepresentative: false,
        isObserver: false,
      },
      ll: {
        name: "Lower Left",
        team: Team.Left,
        isModerator: false,
        isRepresentative: false,
        isObserver: false,
      },
      ur: {
        name: "Upper Right",
        team: Team.Right,
        isModerator: false,
        isRepresentative: false,
        isObserver: false,
      },
      lr: {
        name: "Lower Right",
        team: Team.Right,
        isModerator: false,
        isRepresentative: false,
        isObserver: false,
      },
    },
  });

  const submitAction = (_action: RoomAction) => setGameState(gameState);

  const style: React.CSSProperties = {
    width: 500,
    margin: 4,
    padding: 4,
    border: "1px solid black",
  };

  const renderGame = (playerId: string) => (
    <div style={style}>
      <GameModelContext.Provider
        value={BuildGameModel(
          {
            ...gameState,
            viewer: {
              ...gameState.viewer,
              playerId,
            },
          },
          submitAction,
          fallbackWordpackCards,
          () => {}
        )}
      >
        <ActiveGame />
      </GameModelContext.Provider>
    </div>
  );

  return (
    <CenteredRow
      style={{ alignItems: "stretch", position: "absolute", top: 100, left: 0 }}
    >
      <CenteredColumn
        style={{
          alignItems: "stretch",
          justifyContent: "space-between",
        }}
      >
        {renderGame("ul")}
        {renderGame("ll")}
      </CenteredColumn>
      <CenteredColumn
        style={{
          alignItems: "stretch",
          justifyContent: "space-between",
        }}
      >
        {renderGame("ur")}
        {renderGame("lr")}
      </CenteredColumn>
    </CenteredRow>
  );
}

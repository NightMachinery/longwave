import React, { useContext } from "react";
import { RoundPhase, Team, TeamName } from "../../state/GameState";
import { CenteredColumn, CenteredRow } from "../common/LayoutElements";
import { Button } from "../common/Button";
import { GameModelContext } from "../../state/GameModelContext";
import { useTranslation } from "react-i18next";

export function JoinTeam() {
  const { t } = useTranslation();
  const { gameState, localPlayer, submitAction } = useContext(GameModelContext);

  const leftTeam = Object.keys(gameState.players).filter(
    (playerId) =>
      gameState.players[playerId].team === Team.Left &&
      !gameState.players[playerId].isObserver
  );
  const rightTeam = Object.keys(gameState.players).filter(
    (playerId) =>
      gameState.players[playerId].team === Team.Right &&
      !gameState.players[playerId].isObserver
  );

  const joinTeam = (team: Team) => submitAction({ type: "join_team", team });

  return (
    <CenteredColumn>
      <div>{t("jointeam.join_team")}:</div>
      <CenteredRow style={{ alignItems: "flex-start", width: "100%" }}>
        <TeamPane
          title={TeamName(Team.Left, t)}
          members={leftTeam.map((playerId) => gameState.players[playerId].name)}
          buttonText={t("jointeam.join_left")}
          onJoin={() => joinTeam(Team.Left)}
          disabled={!gameState.viewer.canChangeTeam || localPlayer.isObserver}
        />
        <TeamPane
          title={TeamName(Team.Right, t)}
          members={rightTeam.map((playerId) => gameState.players[playerId].name)}
          buttonText={t("jointeam.join_right")}
          onJoin={() => joinTeam(Team.Right)}
          disabled={!gameState.viewer.canChangeTeam || localPlayer.isObserver}
        />
      </CenteredRow>
      {gameState.roundPhase === RoundPhase.PickTeams && (
        <Button
          text={t("jointeam.start_game")}
          onClick={() => submitAction({ type: "start_round" })}
          disabled={!gameState.viewer.canStartRound}
        />
      )}
    </CenteredColumn>
  );
}

function TeamPane(props: {
  title: string;
  members: string[];
  buttonText: string;
  onJoin: () => void;
  disabled: boolean;
}) {
  return (
    <CenteredColumn style={{ alignItems: "flex-start", minWidth: 160 }}>
      <div>{props.title}</div>
      {props.members.map((member) => (
        <div key={member}>{member}</div>
      ))}
      <Button text={props.buttonText} onClick={props.onJoin} disabled={props.disabled} />
    </CenteredColumn>
  );
}

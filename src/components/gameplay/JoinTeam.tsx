import React, { useContext } from "react";
import { RoundPhase, Team, TeamName } from "../../state/GameState";
import { CenteredColumn, CenteredRow } from "../common/LayoutElements";
import { Button } from "../common/Button";
import { GameModelContext } from "../../state/GameModelContext";
import { useTranslation } from "react-i18next";

export function JoinTeam() {
  const { t } = useTranslation();
  const { gameState, localPlayer, submitAction } = useContext(GameModelContext);
  const canManageRoom = gameState.viewer.canManageRoom;

  const activePlayers = Object.keys(gameState.players).filter(
    (playerId) => !gameState.players[playerId].isObserver
  );
  const leftTeam = activePlayers.filter(
    (playerId) => gameState.players[playerId].team === Team.Left
  );
  const rightTeam = activePlayers.filter(
    (playerId) => gameState.players[playerId].team === Team.Right
  );
  const unassignedPlayers = activePlayers.filter(
    (playerId) => gameState.players[playerId].team === Team.Unset
  );

  const joinTeam = (team: Team) => submitAction({ type: "join_team", team });
  const assignTeam = (playerId: string, team: Team) =>
    submitAction({ type: "set_team", playerId, team });

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
      {canManageRoom && (
        <CenteredColumn style={{ alignItems: "flex-start", marginTop: 16 }}>
          <div>{t("jointeam.assign_players", "Assign players")}</div>
          {activePlayers.map((playerId) => {
            const player = gameState.players[playerId];
            return (
              <CenteredRow key={playerId} style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  {player.name}
                  {playerId === localPlayer.id ? ` ${t("jointeam.you", "(you)")}` : ""}
                  {player.team === Team.Unset ? ` — ${t("jointeam.unassigned", "unassigned")}` : ""}
                </div>
                <Button
                  text={t("jointeam.assign_left", "Left")}
                  onClick={() => assignTeam(playerId, Team.Left)}
                  disabled={player.team === Team.Left}
                />
                <Button
                  text={t("jointeam.assign_right", "Right")}
                  onClick={() => assignTeam(playerId, Team.Right)}
                  disabled={player.team === Team.Right}
                />
              </CenteredRow>
            );
          })}
          {unassignedPlayers.length > 0 && (
            <div>{t("jointeam.unassigned_count", { defaultValue: "Unassigned players: {{count}}", count: unassignedPlayers.length })}</div>
          )}
        </CenteredColumn>
      )}
      {gameState.roundPhase === RoundPhase.PickTeams && (
        <Button
          text={t("jointeam.start_game")}
          onClick={() => submitAction({ type: "start_round" })}
          disabled={!gameState.viewer.canStartRound}
        />
      )}
      {gameState.roundPhase === RoundPhase.PickTeams && !gameState.viewer.canStartRound && !canManageRoom && (
        <div>{t("jointeam.waiting_for_mod", "Waiting for a moderator to start the game.")}</div>
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

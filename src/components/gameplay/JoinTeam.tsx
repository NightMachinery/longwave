import React, { useContext } from "react";
import { RoundPhase, Team, TeamName } from "../../state/GameState";
import { CenteredColumn, CenteredRow } from "../common/LayoutElements";
import { Button } from "../common/Button";
import { GameModelContext } from "../../state/GameModelContext";
import { useTranslation } from "react-i18next";
import { PlayerManagementCard, SectionTitle } from "./PlayerManagement";
import { PreviousGameResultBanner } from "./PreviousGameResult";

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

  return (
    <CenteredColumn style={{ alignItems: "stretch", gap: 16 }}>
      <PreviousGameResultBanner />
      <SectionTitle>{t("jointeam.join_team")}:</SectionTitle>
      {canManageRoom && gameState.roundPhase === RoundPhase.PickTeams && (
        <CenteredRow style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={gameState.randomizeTeams}
              onChange={(event) =>
                submitAction({ type: "set_randomize_teams", value: event.target.checked })
              }
            />
            {t("jointeam.randomize_assignments", "Randomize player assignments")}
          </label>
          <Button
            text={t("jointeam.randomize_teams", "Randomize Teams")}
            onClick={() => submitAction({ type: "randomize_teams" })}
            variant="secondary"
            style={{ alignSelf: "flex-start" }}
          />
        </CenteredRow>
      )}
      <CenteredRow style={{ alignItems: "stretch", width: "100%", gap: 12, flexWrap: "wrap" }}>
        <TeamPane
          title={TeamName(Team.Left, t)}
          members={leftTeam.map((playerId) => gameState.players[playerId].displayName ?? gameState.players[playerId].name)}
          buttonText={t("jointeam.join_left")}
          onJoin={() => joinTeam(Team.Left)}
          disabled={!gameState.viewer.canChangeTeam || localPlayer.isObserver}
        />
        <TeamPane
          title={TeamName(Team.Right, t)}
          members={rightTeam.map((playerId) => gameState.players[playerId].displayName ?? gameState.players[playerId].name)}
          buttonText={t("jointeam.join_right")}
          onJoin={() => joinTeam(Team.Right)}
          disabled={!gameState.viewer.canChangeTeam || localPlayer.isObserver}
        />
      </CenteredRow>
      {canManageRoom && (
        <CenteredColumn style={{ alignItems: "stretch", marginTop: 8 }}>
          <SectionTitle>{t("jointeam.assign_players", "Manage players")}</SectionTitle>
          {Object.keys(gameState.players).map((playerId) => (
            <div key={playerId} style={{ marginBottom: 10, width: "100%" }}>
              <PlayerManagementCard
                playerId={playerId}
                showTeamSelector
                submitAction={submitAction}
              />
            </div>
          ))}
          {unassignedPlayers.length > 0 && (
            <div>
              {t("jointeam.unassigned_count", {
                defaultValue: "Unassigned players: {{count}}",
                count: unassignedPlayers.length,
              })}
            </div>
          )}
        </CenteredColumn>
      )}
      {gameState.roundPhase === RoundPhase.PickTeams && (
        <Button
          text={t("jointeam.start_game")}
          onClick={() => submitAction({ type: "start_round" })}
          disabled={!gameState.viewer.canStartRound}
          style={{ alignSelf: "flex-start" }}
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
    <CenteredColumn
      style={{
        alignItems: "stretch",
        minWidth: 220,
        flex: 1,
        border: "1px solid #d1d5db",
        borderRadius: 16,
        backgroundColor: "#f9fafb",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{props.title}</div>
      {props.members.length === 0 && (
        <div style={{ color: "#6b7280", marginBottom: 8 }}>—</div>
      )}
      {props.members.map((member) => (
        <div key={member} style={{ marginBottom: 6 }}>
          {member}
        </div>
      ))}
      <Button
        text={props.buttonText}
        onClick={props.onJoin}
        disabled={props.disabled}
        style={{ alignSelf: "flex-start", marginLeft: 0, marginTop: 12 }}
      />
    </CenteredColumn>
  );
}

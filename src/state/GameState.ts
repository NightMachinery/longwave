import { RandomFourCharacterString } from "./RandomFourCharacterString";
import { TFunction } from "i18next";
import { normalizeWordpack } from "./Wordpack";

export enum RoundPhase {
  SetupGame,
  Ready,
  PickTeams,
  GiveClue,
  MakeGuess,
  CounterGuess,
  ViewScore,
}

export enum GameType {
  Teams,
  Cooperative,
  Freeplay,
  Individual,
}

export enum Team {
  Unset,
  Left,
  Right,
}

export function TeamReverse(team: Team) {
  if (team === Team.Left) {
    return Team.Right;
  }
  if (team === Team.Right) {
    return Team.Left;
  }
  return Team.Unset;
}

export function TeamName(team: Team, t: TFunction<string>) {
  if (team === Team.Left) {
    return t("gamestate.left_brain");
  }
  if (team === Team.Right) {
    return t("gamestate.right_brain");
  }
  return t("gamestate.the_player");
}

export type PlayerState = {
  name: string;
  team: Team;
  isModerator: boolean;
  isRepresentative: boolean;
  isObserver: boolean;
};

export type PlayersTeams = {
  [playerId: string]: PlayerState;
};

export type Clue = {
  authorId: string;
  authorName: string;
  text: string;
  order: number;
};

export type TurnSummaryModel = {
  deckIndex: number;
  clueAuthorName: string;
  clues: Clue[];
  spectrumTarget: number;
  guess: number;
};

export type PreviousGameResult = {
  gameType: GameType;
  winnerTeam: Team;
  loserTeam: Team;
  leftScore: number;
  rightScore: number;
  coopScore: number;
  individualScores?: { [playerId: string]: number };
  winnerIds?: string[];
};

export type ViewerState = {
  playerId: string;
  canManageRoom: boolean;
  canSetGuess: boolean;
  canSubmitGuess: boolean;
  canSubmitCounterGuess: boolean;
  canSubmitClue: boolean;
  canStartRound: boolean;
  canChangeTeam: boolean;
  canRerollRound: boolean;
  effectiveClueQuota: number;
  submittedClueCount: number;
  remainingPsychicRerolls: number;
  isCurrentPsychic: boolean;
  isTemporaryRep: boolean;
};

export interface GameState {
  roomId: string;
  gameType: GameType;
  roundPhase: RoundPhase;
  turnsTaken: number;
  deckSeed: string;
  deckIndex: number;
  spectrumTarget: number;
  clues: Clue[];
  guess: number;
  counterGuess: "left" | "right" | "exact";
  players: PlayersTeams;
  psychicIds: string[];
  actingTeam: Team;
  leftScore: number;
  rightScore: number;
  coopScore: number;
  coopBonusTurns: number;
  previousTurn: TurnSummaryModel | null;
  previousGameResult: PreviousGameResult | null;
  deckLanguage: string | null;
  wordpack: string;
  wordpacks: string[];
  creatorId: string;
  psychicCount: number;
  clueQuota: number;
  psychicRerollLimit: number;
  psychicRerollsUsed: number;
  individualScores: { [playerId: string]: number };
  individualGuesses: { [playerId: string]: number };
  clueGiverCounts: { [playerId: string]: number };
  individualClueGiverTarget: number;
  randomizeTeams: boolean;
  viewer: ViewerState;
}

export function InitialGameState(deckLanguage: string = "en"): GameState {
  return {
    roomId: "",
    gameType: GameType.Teams,
    roundPhase: RoundPhase.SetupGame,
    turnsTaken: -1,
    deckSeed: RandomFourCharacterString(),
    deckIndex: 0,
    spectrumTarget: 0,
    clues: [],
    guess: 10,
    counterGuess: "left",
    players: {},
    psychicIds: [],
    actingTeam: Team.Unset,
    leftScore: 0,
    rightScore: 0,
    coopScore: 0,
    coopBonusTurns: 0,
    previousTurn: null,
    previousGameResult: null,
    deckLanguage,
    wordpack: normalizeWordpack(deckLanguage),
    wordpacks: [normalizeWordpack(deckLanguage)],
    creatorId: "",
    psychicCount: 1,
    clueQuota: 1,
    psychicRerollLimit: 2,
    psychicRerollsUsed: 0,
    individualScores: {},
    individualGuesses: {},
    clueGiverCounts: {},
    individualClueGiverTarget: 1,
    randomizeTeams: true,
    viewer: {
      playerId: "",
      canManageRoom: false,
      canSetGuess: false,
      canSubmitGuess: false,
      canSubmitCounterGuess: false,
      canSubmitClue: false,
      canStartRound: false,
      canChangeTeam: false,
      canRerollRound: false,
      effectiveClueQuota: 1,
      submittedClueCount: 0,
      remainingPsychicRerolls: 2,
      isCurrentPsychic: false,
      isTemporaryRep: false,
    },
  };
}

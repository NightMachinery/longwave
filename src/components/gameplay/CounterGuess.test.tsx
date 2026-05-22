import { fireEvent, render } from "@testing-library/react";
import { GameType, InitialGameState, RoundPhase, Team } from "../../state/GameState";
import { CounterGuess } from "./CounterGuess";
import { TestContext } from "./TestContext";

test("submits an exact counter guess", () => {
  const submitAction = vi.fn();
  const component = render(
    <TestContext
      gameState={{
        ...InitialGameState(),
        roundPhase: RoundPhase.CounterGuess,
        gameType: GameType.Teams,
        actingTeam: Team.Left,
        guess: 10,
        viewer: {
          ...InitialGameState().viewer,
          canSubmitCounterGuess: true,
        },
      }}
      playerId="player1"
      submitAction={submitAction}
    >
      <CounterGuess />
    </TestContext>
  );

  fireEvent.click(component.getByRole("button", { name: "Target is exactly here" }));

  expect(submitAction).toHaveBeenCalledWith({
    type: "submit_counterguess",
    counterGuess: "exact",
  });
});

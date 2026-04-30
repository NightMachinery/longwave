import { BuildGameModel } from "./BuildGameModel";
import { InitialGameState } from "./GameState";
import { WordpackCard } from "./Wordpack";

const noop = () => undefined;

function card(left: string, right: string): WordpackCard {
  return { left: { text: left }, right: { text: right } };
}

describe("BuildGameModel", () => {
  it("uses the current wordpack cards when rebuilding with the same deck seed", () => {
    const gameState = {
      ...InitialGameState(),
      deckSeed: "SAME",
      deckIndex: 0,
    };

    const englishModel = BuildGameModel(
      gameState,
      noop,
      [card("Hot", "Cold")],
      noop
    );
    const persianModel = BuildGameModel(
      gameState,
      noop,
      [card("گرم", "سرد")],
      noop
    );

    expect(englishModel.spectrumCard.left.text).toBe("Hot");
    expect(persianModel.spectrumCard.left.text).toBe("گرم");
    expect(persianModel.spectrumCard.right.text).toBe("سرد");
  });

  it("uses the current wordpack cards for previous turns with the same deck seed", () => {
    const gameState = {
      ...InitialGameState(),
      deckSeed: "SAME",
      deckIndex: 0,
      previousTurn: {
        deckIndex: 0,
        clueAuthorName: "Psychic",
        clues: [],
        spectrumTarget: 10,
        guess: 10,
      },
    };

    BuildGameModel(gameState, noop, [card("Hot", "Cold")], noop);
    const persianModel = BuildGameModel(
      gameState,
      noop,
      [card("گرم", "سرد")],
      noop
    );

    expect(persianModel.previousSpectrumCard?.left.text).toBe("گرم");
    expect(persianModel.previousSpectrumCard?.right.text).toBe("سرد");
  });
});

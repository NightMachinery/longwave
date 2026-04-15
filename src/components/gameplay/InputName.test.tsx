import { fireEvent, render } from "@testing-library/react";
import { Suspense } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18nForTests";
import { InputName } from "./InputName";

describe("InputName", () => {
  it("submits the entered name when the button is clicked", () => {
    const setName = jest.fn();
    const component = render(
      <Suspense fallback={<div>Loading...</div>}>
        <I18nextProvider i18n={i18n}>
          <InputName setName={setName} />
        </I18nextProvider>
      </Suspense>
    );

    fireEvent.change(component.getByRole("textbox"), {
      target: { value: "Alice" },
    });
    fireEvent.click(component.getByRole("button", { name: "Save name" }));

    expect(setName).toHaveBeenCalledWith("Alice");
  });

  it("still submits the entered name when pressing enter", () => {
    const setName = jest.fn();
    const component = render(
      <Suspense fallback={<div>Loading...</div>}>
        <I18nextProvider i18n={i18n}>
          <InputName setName={setName} />
        </I18nextProvider>
      </Suspense>
    );

    fireEvent.change(component.getByRole("textbox"), {
      target: { value: "Bob" },
    });
    fireEvent.keyDown(component.getByRole("textbox"), {
      key: "Enter",
      code: "Enter",
      charCode: 13,
    });

    expect(setName).toHaveBeenCalledWith("Bob");
  });
});

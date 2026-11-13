import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "../components/ui/Modal";
test("popup supports Escape, focus containment, and restoration", () => {
  const previous = document.createElement("button");
  document.body.appendChild(previous);
  previous.focus();
  const close = jest.fn();
  const { unmount } = render(
    <Modal isOpen onClose={close} title="Configure step" placement="right">
      <input aria-label="Value" />
      <button>Done</button>
    </Modal>,
  );
  const dialog = screen.getByRole("dialog");
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(document, { key: "Tab" });
  expect(screen.getByRole("button", { name: "Close modal" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(screen.getByRole("button", { name: "Done" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(screen.getByRole("button", { name: "Close modal" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(close).toHaveBeenCalledTimes(1);
  expect(dialog).toHaveAttribute("aria-modal", "true");
  unmount();
  expect(previous).toHaveFocus();
  expect(document.body.style.overflow).toBe("");
  previous.remove();
});
test("closed dialogs render no configuration content", () => {
  render(
    <Modal isOpen={false} onClose={jest.fn()} title="Hidden">
      <input aria-label="Secret" />
    </Modal>,
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
test("the close button closes the popup", () => {
  const close = jest.fn();
  render(
    <Modal isOpen onClose={close} title="Setup">
      Content
    </Modal>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Close modal" }));
  expect(close).toHaveBeenCalled();
});

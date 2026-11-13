import React, { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  Button,
  PrimaryButton,
  SecondaryButton,
  GhostButton,
  DangerButton,
} from "../components/ui/Button";
import { Input } from "../components/ui/Input";

test("button responds to a click and defaults to a non-submit type", () => {
  const onClick = jest.fn();
  render(<Button onClick={onClick}>Run workflow</Button>);
  const button = screen.getByRole("button", { name: "Run workflow" });
  expect(button).toHaveAttribute("type", "button");
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
});
test("disabled button does not invoke its handler", () => {
  const onClick = jest.fn();
  render(
    <Button disabled onClick={onClick}>
      Run
    </Button>,
  );
  fireEvent.click(screen.getByRole("button"));
  expect(onClick).not.toHaveBeenCalled();
});
test.each([PrimaryButton, SecondaryButton, GhostButton, DangerButton])(
  "button wrapper preserves disabled behavior",
  (Component) => {
    render(<Component disabled>Unavailable</Component>);
    expect(screen.getByRole("button")).toBeDisabled();
  },
);
test("primary button accepts an explicit submit type", () => {
  render(<PrimaryButton type="submit">Save</PrimaryButton>);
  expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
});
test("input is associated with its label and forwards changes/ref", () => {
  const onChange = jest.fn();
  const ref = createRef();
  render(<Input label="Email address" ref={ref} onChange={onChange} />);
  const input = screen.getByLabelText("Email address");
  expect(ref.current).toBe(input);
  expect(input).toHaveAttribute("id", "email-address");
  fireEvent.change(input, { target: { value: "unit@example.test" } });
  expect(onChange).toHaveBeenCalledTimes(1);
});
test("input exposes its error instead of its hint", () => {
  render(<Input label="Email" id="recipient" error="Invalid email" hint="Enter an address" />);
  expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByLabelText("Email")).toHaveAttribute("aria-describedby", "recipient-error");
  expect(screen.getByRole("alert")).toHaveTextContent("Invalid email");
  expect(screen.queryByText("Enter an address")).not.toBeInTheDocument();
});
test("input connects its hint and preserves disabled state", () => {
  render(<Input label="Name" hint="Your name" disabled />);
  const input = screen.getByLabelText("Name");
  expect(input).toBeDisabled();
  expect(input).toHaveAttribute("aria-invalid", "false");
  expect(input).toHaveAttribute("aria-describedby", "name-hint");
});

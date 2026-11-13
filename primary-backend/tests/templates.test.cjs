const { validTemplate, renderText, renderCell, TemplateError } = require("../src/templates.ts");
const context = {
  issue: { title: "Payment bug", number: 42, body: null, open: true },
  repository: { full_name: "owner/repo" },
  values: ["first"],
};
test("resolves multiple fields, numbers, booleans, nullable descriptions and array indices", () => {
  expect(
    renderText(
      "{{issue.title}} #{{ issue.number }} {{issue.open}} {{issue.body}} {{values.0}}",
      context,
    ),
  ).toBe("Payment bug #42 true  first");
  expect(renderCell("{{issue.number}}", context)).toBe(42);
  expect(renderCell("{{issue.open}}", context)).toBe(true);
  expect(renderCell("Issue #{{issue.number}}", context)).toBe("Issue #42");
  expect(renderText("static text", {})).toBe("static text");
});
test("does not evaluate templates contained inside event data", () => {
  expect(renderText("{{issue.title}}", { issue: { title: "{{constructor}}" } })).toBe(
    "{{constructor}}",
  );
});
test.each([
  "{{__proto__.x}}",
  "{{issue.constructor}}",
  "{{prototype}}",
  "{{issue[0]}}",
  "{{process.exit()}}",
  "{{}}",
  "{{issue",
  "issue}}",
  "{{a\nb}}",
  "{{" + "a".repeat(161) + "}}",
  "{{a.b.c.d.e.f.g.h.i}}",
  "{{a}}".repeat(51),
  "x".repeat(40001),
])("rejects unsafe or malformed expressions", (value) => {
  expect(validTemplate(value)).toBe(false);
  expect(() => renderText(value, context)).toThrow(TemplateError);
});
test.each(["{{missing}}", "{{issue.missing}}", "{{issue.title.deep}}"])(
  "missing data fails explicitly",
  (value) => expect(() => renderText(value, context)).toThrow("MISSING_EVENT_FIELD"),
);
test.each([
  { value: {} },
  { value: [] },
  { value: undefined },
  { value: NaN },
  { value: Infinity },
])("rejects non-scalar fields", (value) =>
  expect(() => renderText("{{value}}", value)).toThrow("INVALID_EVENT_FIELD"),
);
test("does not traverse inherited properties or invoke getters", () => {
  expect(() => renderText("{{hidden}}", Object.create({ hidden: "secret" }))).toThrow(
    "MISSING_EVENT_FIELD",
  );
  const getter = jest.fn();
  const data = {};
  Object.defineProperty(data, "hidden", { get: getter });
  expect(() => renderText("{{hidden}}", data)).toThrow("MISSING_EVENT_FIELD");
  expect(getter).not.toHaveBeenCalled();
});
test("limits resolved text and cell size", () => {
  expect(() => renderText("{{large}}", { large: "x".repeat(6) }, 5)).toThrow(
    "RESOLVED_VALUE_TOO_LONG",
  );
  expect(() => renderCell("{{large}}", { large: "x".repeat(40001) })).toThrow(
    "RESOLVED_VALUE_TOO_LONG",
  );
});

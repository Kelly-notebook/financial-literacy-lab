/** Strict parsing: separators are display-only, never silently accept malformed groups. */
export function parseNumericInput(text: string | undefined): number {
  const value = text?.trim() ?? "";
  if (
    !/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?$/.test(value) &&
    !/^-?\.\d+$/.test(value)
  )
    return NaN;
  return Number(value.replaceAll(",", ""));
}
/** Preserve decimal digits, trailing dot, minus, and leading zeroes while editing. */
export function formatMoneyInput(text: string): string {
  const raw = text.replaceAll(",", "");
  if (!/^-?\d*(?:\.\d*)?$/.test(raw)) return text;
  const [integer, fraction] = raw.split(".");
  return (
    integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    (fraction === undefined ? "" : `.${fraction}`)
  );
}
export function editMoneyInput(
  text: string,
  caret: number,
  previous: string,
  inputType = "",
) {
  let raw = text.replaceAll(",", "");
  let logicalCaret = text.slice(0, caret).replaceAll(",", "").length;
  // Backspace/Delete on a separator must delete a digit, rather than reinsert the separator forever.
  if (
    raw === previous.replaceAll(",", "") &&
    text !== previous &&
    inputType.startsWith("delete")
  ) {
    const index =
      inputType === "deleteContentBackward" ? logicalCaret - 1 : logicalCaret;
    if (index >= 0 && /\d/.test(raw[index] ?? "")) {
      raw = raw.slice(0, index) + raw.slice(index + 1);
      if (inputType === "deleteContentBackward") logicalCaret--;
    }
  }
  const formatted = formatMoneyInput(raw);
  let position = 0,
    logical = 0;
  while (position < formatted.length && logical < logicalCaret) {
    if (formatted[position] !== ",") logical++;
    position++;
  }
  return { text: formatted, caret: position };
}

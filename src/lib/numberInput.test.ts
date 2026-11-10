import { describe, it, expect } from "vitest";
import {
  parseNumericInput,
  formatMoneyInput,
  editMoneyInput,
} from "./numberInput";
describe("千分位金額", () => {
  it.each([
    ["100,000", 100000],
    ["1,000,000.25", 1000000.25],
    ["-1,000.50", -1000.5],
    [".5", 0.5],
    ["0", 0],
  ])("解析 %s", (text, value) => expect(parseNumericInput(text)).toBe(value));
  it.each(["", "-", ".", "1,00", "abc", "1e3", "1.2.3"])(
    "拒絕不完整或錯誤字串 %s",
    (text) => expect(parseNumericInput(text)).toBeNaN(),
  );
  it.each([
    ["1000000", "1,000,000"],
    ["-1000.50", "-1,000.50"],
    ["1000.", "1,000."],
    ["-", "-"],
    ["", ""],
    ["0.00", "0.00"],
  ])("顯示保留編輯資訊 %s", (text, formatted) =>
    expect(formatMoneyInput(text)).toBe(formatted),
  );
  it("中間插入數字仍定位在新增數字之後", () =>
    expect(editMoneyInput("12,930", 4, "12,30", "insertText")).toEqual({
      text: "12,930",
      caret: 4,
    }));
  it("跨越千分位新增數字不跳到字尾", () =>
    expect(editMoneyInput("9123,456", 1, "123,456", "insertText")).toEqual({
      text: "9,123,456",
      caret: 1,
    }));
  it("Backspace 遇到逗號繼續刪除前面的數字", () =>
    expect(editMoneyInput("1234", 1, "1,234", "deleteContentBackward")).toEqual(
      { text: "234", caret: 0 },
    ));
  it("Delete 遇到逗號刪除後面的數字", () =>
    expect(editMoneyInput("1234", 1, "1,234", "deleteContentForward")).toEqual({
      text: "134",
      caret: 1,
    }));
  it("可以刪空、保留負號及尾端小數點", () => {
    expect(editMoneyInput("", 0, "1", "deleteContentBackward").text).toBe("");
    expect(editMoneyInput("-", 1, "", "insertText").text).toBe("-");
    expect(editMoneyInput("1,000.", 6, "1,000", "insertText").text).toBe(
      "1,000.",
    );
  });
});

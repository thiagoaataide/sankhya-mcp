import assert from "node:assert/strict";
import { test } from "node:test";
import { isMissingBinaryError, windowsCandidates } from "./op-bin.js";

test("windows candidates include Program Files and WinGet Links", () => {
  const list = windowsCandidates({
    LOCALAPPDATA: "C:\\Users\\thiag\\AppData\\Local",
    USERPROFILE: "C:\\Users\\thiag",
  });
  assert.ok(list.some((path) => path.includes("1Password CLI")));
  assert.ok(list.some((path) => path.includes("WinGet\\Links\\op.exe")));
});

test("detects spawn ENOENT", () => {
  assert.equal(isMissingBinaryError({ code: "ENOENT", message: "spawn op ENOENT" }), true);
});

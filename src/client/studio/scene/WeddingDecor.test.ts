import { describe, expect, it } from "vitest";
import { defaultOptions } from "../model/schema";

describe("wedding decoration view defaults",()=>{
  it("starts with decorations visible in stage-only mode",()=>{
    expect(defaultOptions.decorations).toBe(true);
    expect(defaultOptions.decorationMode).toBe("stage");
  });
});

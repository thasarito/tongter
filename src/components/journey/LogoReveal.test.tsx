import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LogoReveal from "./LogoReveal";

describe("LogoReveal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the supplied wide vector logo at its intrinsic proportions", () => {
    render(<LogoReveal lang="en" onDone={vi.fn()} />);

    const logo = screen.getByRole("img", {
      name: "Warissara & Thasarit",
    });

    expect(logo).toHaveAttribute("src", "/logo.svg");
    expect(logo).toHaveAttribute("width", "760");
    expect(logo).toHaveAttribute("height", "275");
  });
});

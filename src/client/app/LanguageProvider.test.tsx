import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider, useLanguage } from "./LanguageProvider";

describe("LanguageProvider", () => {
  beforeEach(() => {
    document.cookie = "wedding-lang=; Max-Age=0; Path=/";
    document.documentElement.lang = "";
  });

  it("defaults to Thai and persists a language change", () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <LanguageProvider>{children}</LanguageProvider>
    );
    const { result } = renderHook(useLanguage, { wrapper });

    expect(result.current.lang).toBe("th");
    act(() => result.current.setLang("en"));
    expect(result.current.lang).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(document.cookie).toContain("wedding-lang=en");
  });
});

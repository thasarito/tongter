import { isLang, type Lang } from "@/shared/i18n";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

const COOKIE = "wedding-lang";

function initialLanguage(): Lang {
  const requested = new URLSearchParams(window.location.search).get("lang");
  if (requested && isLang(requested)) return requested;

  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  return value && isLang(value) ? value : "th";
}

const LanguageContext = createContext<{
  lang: Lang;
  setLang: (lang: Lang) => void;
} | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  const [lang, setLangState] = useState<Lang>(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang(next: Lang) {
        document.cookie = `${COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
        document.documentElement.lang = next;
        setLangState(next);
      },
    }),
    [lang],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used within LanguageProvider");
  return value;
}

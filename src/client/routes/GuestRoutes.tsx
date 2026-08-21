import { useParams } from "react-router";
import GuestJourney from "@/components/journey/GuestJourney";
import SeatReveal from "@/components/SeatReveal";
import { weddingApi } from "@/client/api/client";
import { useLanguage } from "@/client/app/LanguageProvider";
import { useApiResource } from "@/client/app/useApiResource";
import { ErrorRoute, LoadingRoute, MissingRoute } from "./RouteState";

function resourceView<T>(
  resource: ReturnType<typeof useApiResource<T>>,
  lang: ReturnType<typeof useLanguage>["lang"],
  render: (data: T) => React.ReactNode,
) {
  if (resource.state === "loading") return <LoadingRoute lang={lang} />;
  if (resource.state === "not-found") return <MissingRoute lang={lang} />;
  if (resource.state !== "ready") return <ErrorRoute lang={lang} />;
  return render(resource.data);
}

export function HomeRoute() {
  const { lang } = useLanguage();
  const resource = useApiResource(`intro:${lang}`, () => weddingApi.intro(lang));
  return resourceView(resource, lang, (intro) => (
    <GuestJourney lang={lang} intro={intro} />
  ));
}

export function PersonalInviteRoute() {
  const { lang } = useLanguage();
  const { guestToken = "" } = useParams();
  const resource = useApiResource(`invite:${guestToken}:${lang}`, () =>
    weddingApi.personalInvite(guestToken, lang),
  );
  return resourceView(resource, lang, ({ intro, flow }) => (
    <GuestJourney lang={lang} intro={intro} initialFlow={flow} />
  ));
}

export function GroupInviteRoute() {
  const { lang } = useLanguage();
  const { token = "" } = useParams();
  const resource = useApiResource(`group:${token}:${lang}`, () =>
    weddingApi.groupInvite(token, lang),
  );
  return resourceView(resource, lang, ({ intro, choices }) => (
    <GuestJourney lang={lang} intro={intro} groupChoices={choices} />
  ));
}

export function SeatRoute() {
  const { lang } = useLanguage();
  const { token = "" } = useParams();
  const search = window.location.search;
  const resource = useApiResource(`seat:${token}:${search}:${lang}`, () =>
    weddingApi.seat(token, search, lang),
  );
  return resourceView(resource, lang, ({ view, debug }) => (
    <SeatReveal view={view} lang={lang} debug={debug} />
  ));
}

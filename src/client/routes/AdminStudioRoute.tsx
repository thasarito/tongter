import { lazy, Suspense, useCallback, useState } from "react";
import { weddingApi } from "@/client/api/client";
import { useLanguage } from "@/client/app/LanguageProvider";
import { useApiResource } from "@/client/app/useApiResource";
import { AdminPasscodeScreen } from "@/client/auth/AdminPasscodeScreen";
import { ErrorRoute, LoadingRoute } from "./RouteState";

const GlassHouseStudio = lazy(() => import("@/client/studio/GlassHouseStudio"));

export default function AdminStudioRoute() {
  const { lang } = useLanguage();
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const access = useApiResource(`native-studio-access:${lang}:${revision}`, () => weddingApi.adminSummary(lang));
  if (access.state === "loading") return <LoadingRoute lang={lang} />;
  if (access.state === "unauthorized") return <AdminPasscodeScreen onLogin={refresh} />;
  if (access.state !== "ready") return <ErrorRoute lang={lang} />;
  return <Suspense fallback={<LoadingRoute lang={lang} />}><GlassHouseStudio loadSiteGuests={weddingApi.adminStudioGuests} onUnauthorized={refresh} /></Suspense>;
}

import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { LanguageProvider } from "./app/LanguageProvider";
import { GroupInviteRoute, HomeRoute, PersonalInviteRoute, SeatRoute } from "./routes/GuestRoutes";
import { SearchRoute } from "./routes/SearchRoute";
import { VenueRoute } from "./routes/VenueRoute";
import { LoadingRoute, MissingRoute } from "./routes/RouteState";
import { useLanguage } from "./app/LanguageProvider";
import { AdminQrRoute, AdminRoute } from "./routes/AdminRoutes";
const AdminStudioRoute = lazy(() => import("./routes/AdminStudioRoute"));

function NotFoundRoute() {
  const { lang } = useLanguage();
  return <MissingRoute lang={lang} />;
}
function StudioRoute() {
  const { lang } = useLanguage();
  return <Suspense fallback={<LoadingRoute lang={lang} />}><AdminStudioRoute /></Suspense>;
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/i/:guestToken" element={<PersonalInviteRoute />} />
          <Route path="/rsvp" element={<SearchRoute />} />
          <Route path="/rsvp/:token" element={<GroupInviteRoute />} />
          <Route path="/seat/:token" element={<SeatRoute />} />
          <Route path="/debug/venue" element={<VenueRoute />} />
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="/admin/qr" element={<AdminQrRoute />} />
          <Route path="/admin/studio" element={<StudioRoute />} />
          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

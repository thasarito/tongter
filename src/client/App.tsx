import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router";
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
function AdminDashboardRoute() {
  return <><nav aria-label="Administrator tools" className="mx-auto flex max-w-5xl justify-end px-6 pt-6"><Link to="/admin/studio" className="rounded-full border border-line px-4 py-2 text-sm text-gold">Glass House seating studio →</Link></nav><AdminRoute /></>;
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
          <Route path="/admin" element={<AdminDashboardRoute />} />
          <Route path="/admin/qr" element={<AdminQrRoute />} />
          <Route path="/admin/studio" element={<StudioRoute />} />
          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

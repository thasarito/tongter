import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router";
import { LanguageProvider } from "./app/LanguageProvider";
import { GroupInviteRoute, HomeRoute, PersonalInviteRoute, SeatRoute } from "./routes/GuestRoutes";
import { SearchRoute } from "./routes/SearchRoute";
import { VenueRoute } from "./routes/VenueRoute";
import { MissingRoute } from "./routes/RouteState";
import { useLanguage } from "./app/LanguageProvider";
import { AdminQrRoute, AdminRoute } from "./routes/AdminRoutes";

// Keep the standalone planning runtime off the public RSVP entry bundle.
const AdminStudioRoute = lazy(() => import("./routes/AdminStudioRoute"));

function NotFoundRoute() {
  const { lang } = useLanguage();
  return <MissingRoute lang={lang} />;
}

function AdminHomeRoute() {
  return <>
    <nav aria-label="Administrator tools" className="mx-auto w-full max-w-5xl px-6 pt-6">
      <Link to="/admin/studio" className="inline-block rounded-full border border-line px-4 py-2 text-sm text-gold">Open Glass House seating studio →</Link>
    </nav>
    <AdminRoute />
  </>;
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
          <Route path="/admin" element={<AdminHomeRoute />} />
          <Route path="/admin/qr" element={<AdminQrRoute />} />
          <Route path="/admin/studio" element={<Suspense fallback={<p role="status" className="p-8 text-muted">Loading seating studio…</p>}><AdminStudioRoute /></Suspense>} />
          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

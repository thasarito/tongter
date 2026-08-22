import { BrowserRouter, Route, Routes } from "react-router";
import { LanguageProvider } from "./app/LanguageProvider";
import {
  AppleCalendarRoute,
  GroupInviteRoute,
  HomeRoute,
  PersonalInviteRoute,
  SeatRoute,
} from "./routes/GuestRoutes";
import { SearchRoute } from "./routes/SearchRoute";
import { VenueRoute } from "./routes/VenueRoute";
import { MissingRoute } from "./routes/RouteState";
import { useLanguage } from "./app/LanguageProvider";
import { AdminQrRoute, AdminRoute } from "./routes/AdminRoutes";

function NotFoundRoute() {
  const { lang } = useLanguage();
  return <MissingRoute lang={lang} />;
}

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/calendar/apple" element={<AppleCalendarRoute />} />
          <Route path="/i/:guestToken" element={<PersonalInviteRoute />} />
          <Route path="/rsvp" element={<SearchRoute />} />
          <Route path="/rsvp/:token" element={<GroupInviteRoute />} />
          <Route path="/seat/:token" element={<SeatRoute />} />
          <Route path="/debug/venue" element={<VenueRoute />} />
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="/admin/qr" element={<AdminQrRoute />} />
          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

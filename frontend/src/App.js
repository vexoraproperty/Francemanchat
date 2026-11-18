import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Show } from "@clerk/react";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import { Toaster } from "@/components/ui/sonner";
import { SupportProvider, useSupport } from "@/context/SupportContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import SiteDemo from "@/pages/SiteDemo";
import WidgetFrame from "@/pages/WidgetFrame";
import Inbox from "@/pages/Inbox";
import Visitors from "@/pages/Visitors";
import Analytics from "@/pages/Analytics";
import Team from "@/pages/Team";
import Settings from "@/pages/Settings";
import { SignInPage, SignUpPage } from "@/pages/AuthPages";

function Protected() {
  return (
    <>
      <Show when="signed-in"><SupportProvider><DashboardLayout /></SupportProvider></Show>
      <Show when="signed-out"><Navigate to="/sign-in" replace /></Show>
    </>
  );
}

function AdminOnly({ children }) {
  const { isAdmin } = useSupport();
  return isAdmin ? children : <Navigate to="/inbox" replace />;
}

function MainApp() {
  return (
    <ClerkAuthProvider>
      <Routes>
        <Route path="/" element={<SiteDemo />} />
        <Route path="/products" element={<SiteDemo />} />
        <Route path="/sample-request" element={<SiteDemo />} />
        <Route path="/contact" element={<SiteDemo />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route element={<Protected />}>
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/inbox/:id" element={<Inbox />} />
          <Route path="/visitors" element={<Visitors />} />
          <Route path="/analytics" element={<AdminOnly><Analytics /></AdminOnly>} />
          <Route path="/team" element={<AdminOnly><Team /></AdminOnly>} />
          <Route path="/settings" element={<AdminOnly><Settings /></AdminOnly>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ClerkAuthProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/widget" element={<WidgetFrame />} />
        <Route path="*" element={<MainApp />} />
      </Routes>
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}

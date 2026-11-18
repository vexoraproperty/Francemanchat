import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Show } from "@clerk/react";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import { Toaster } from "@/components/ui/sonner";
import { SupportProvider, useSupport } from "@/context/SupportContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import WidgetFrame from "@/pages/WidgetFrame";
import ChatPage from "@/pages/ChatPage";
import Overview from "@/pages/Overview";
import Inbox from "@/pages/Inbox";
import Visitors from "@/pages/Visitors";
import Contacts from "@/pages/Contacts";
import Analytics from "@/pages/Analytics";
import Team from "@/pages/Team";
import Settings from "@/pages/Settings";
import WidgetSetup from "@/pages/WidgetSetup";
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
        <Route path="/" element={<Navigate to="/inbox" replace />} />
        <Route path="/login" element={<Navigate to="/sign-in" replace />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route element={<Protected />}>
          <Route path="/overview" element={<Overview />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/inbox/:id" element={<Inbox />} />
          <Route path="/visitors" element={<Visitors />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/analytics" element={<AdminOnly><Analytics /></AdminOnly>} />
          <Route path="/widget-setup" element={<AdminOnly><WidgetSetup /></AdminOnly>} />
          <Route path="/team" element={<AdminOnly><Team /></AdminOnly>} />
          <Route path="/settings" element={<AdminOnly><Settings /></AdminOnly>} />
        </Route>
        <Route path="*" element={<Navigate to="/inbox" replace />} />
      </Routes>
    </ClerkAuthProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/widget" element={<WidgetFrame />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="*" element={<MainApp />} />
      </Routes>
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}

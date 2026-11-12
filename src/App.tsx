import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import SetPassword from "./features/ops/SetPassword";
import PrivacyPolicy from "./features/ops/PrivacyPolicy";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/" element={<Index />} />
          <Route path="/admin" element={<Index />} />
          <Route path="/admin/roster" element={<Index />} />
          <Route path="/admin/sign-in" element={<Index />} />
          <Route path="/admin/variations" element={<Index />} />
          <Route path="/admin/communications" element={<Index />} />
          <Route path="/admin/guides" element={<Index />} />
          <Route path="/admin/live-map" element={<Navigate to="/admin#live-map" replace />} />
          <Route path="/mobile" element={<Index />} />
          <Route path="/admin/map" element={<Index />} />
          <Route path="/admin/guards" element={<Index />} />
          <Route path="/admin/sites" element={<Index />} />
          <Route path="/admin/events" element={<Index />} />
          <Route path="/admin/shifts" element={<Index />} />
          <Route path="/admin/rosters" element={<Index />} />
          <Route path="/admin/extensions" element={<Index />} />
          <Route path="/admin/plans" element={<Index />} />
          <Route path="/admin/incidents" element={<Index />} />
          <Route path="/admin/alerts" element={<Index />} />
          <Route path="/admin/reports" element={<Index />} />
          <Route path="/admin/scope" element={<Index />} />
          <Route path="/admin/users" element={<Index />} />
          <Route path="/admin/settings" element={<Index />} />
          <Route path="/mobile/onboarding" element={<Index />} />
          <Route path="/mobile/profile" element={<Index />} />
          <Route path="/mobile/login" element={<Index />} />
          <Route path="/mobile/start-shift" element={<Index />} />
          <Route path="/mobile/briefing" element={<Index />} />
          <Route path="/mobile/active-shift" element={<Index />} />
          <Route path="/mobile/incident" element={<Index />} />
          <Route path="/mobile/end-shift" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

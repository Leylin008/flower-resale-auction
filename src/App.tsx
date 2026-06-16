
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Component, ReactNode } from "react";
import Index from "./pages/Index";
import Partners from "./pages/Partners";
import Investor from "./pages/Investor";
import Negotiation from "./pages/Negotiation";
import Pitch from "./pages/Pitch";
import Anime from "./pages/Anime";
import Privacy from "./pages/Privacy";
import Cookies from "./pages/Cookies";
import Terms from "./pages/Terms";
import Offer from "./pages/Offer";
import CookieBanner from "./components/CookieBanner";
import NotFound from "./pages/NotFound";
import { MaintenanceProvider } from "@/lib/maintenance";

const queryClient = new QueryClient();

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0d0d14", color: "#fff", padding: 24, gap: 16 }}>
        <span style={{ fontSize: 48 }}>🌸</span>
        <p style={{ fontSize: 18, fontWeight: 600 }}>Что-то пошло не так</p>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center" }}>{this.state.error}</p>
        <button onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          style={{ marginTop: 8, padding: "10px 28px", borderRadius: 12, background: "linear-gradient(135deg,#ff3d8b,#a855f7)", color: "#fff", border: "none", cursor: "pointer", fontSize: 14 }}>
          Обновить страницу
        </button>
      </div>
    );
    return this.props.children;
  }
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <MaintenanceProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/investor" element={<Investor />} />
            <Route path="/negotiation" element={<Negotiation />} />
            <Route path="/pitch" element={<Pitch />} />
            <Route path="/anime" element={<Anime />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/offer" element={<Offer />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <CookieBanner />
        </BrowserRouter>
        </MaintenanceProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
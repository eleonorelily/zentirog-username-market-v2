import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { ADMIN_ROUTE } from "./config/routes";

const Admin = lazy(() => import("./pages/Admin"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route
            path={ADMIN_ROUTE}
            element={
              <Suspense
                fallback={
                  <div className="min-h-screen bg-[#090a0d] flex items-center justify-center p-4 text-[#eaebee] font-mono">
                    <div className="border border-[#23252c] bg-[#101115] p-6 text-center max-w-xs w-full">
                      <div className="text-xs uppercase tracking-widest text-[#d4af37] mb-2">LOADING</div>
                      <p className="text-xs text-neutral-400">Loading module...</p>
                    </div>
                  </div>
                }
              >
                <Admin />
              </Suspense>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

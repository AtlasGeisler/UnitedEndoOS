import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/api";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { QuickLookProvider } from "@/components/QuickLook";
import { App } from "@/App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <QuickLookProvider>
            <App />
          </QuickLookProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);

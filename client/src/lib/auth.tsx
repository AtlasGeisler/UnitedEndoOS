import { createContext, useContext } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./api";

export interface AuthedUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  title: string | null;
  homeClinicId: number | null;
  clinicIds: number[];
}

interface AuthCtx {
  user: AuthedUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest<{ user: AuthedUser | null }>("GET", "/api/auth/me"),
  });

  const loginMut = useMutation({
    mutationFn: (vars: { email: string; password: string }) =>
      apiRequest("POST", "/api/auth/login", vars),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }),
  });

  const logoutMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: () => queryClient.clear(),
  });

  const value: AuthCtx = {
    user: data?.user ?? null,
    isLoading,
    login: async (email, password) => {
      await loginMut.mutateAsync({ email, password });
    },
    logout: async () => {
      await logoutMut.mutateAsync();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// The friendly label for a role code.
export const ROLE_LABELS: Record<string, string> = {
  practice_owner: "Practice Owner",
  office_manager: "Office Manager",
  clinical_provider: "Provider",
  front_desk: "Front Desk",
  admin: "Administrator",
  referring_doctor: "Referring Doctor",
};

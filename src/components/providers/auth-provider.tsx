"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearToken,
  getCurrentUser,
  getActiveCompanyId,
  setActiveCompanyId,
  setToken,
  type JwtClaims,
} from "@/lib/auth";
import { authApi, type LoginResponse } from "@/lib/api";

interface AuthContextValue {
  user: JwtClaims | null;
  activeCompanyId: number | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchCompany: (companyId: number) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<JwtClaims | null>(null);
  const [activeCompanyId, setActive] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const claims = getCurrentUser();
    setUser(claims);
    if (claims) {
      const stored = getActiveCompanyId();
      const first = claims.companies[0]?.companyId ?? null;
      setActive(stored ?? first);
    }
    setIsLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const resp: LoginResponse = await authApi.login(email, password);
    setToken(resp.token);
    const claims = getCurrentUser()!;
    setUser(claims);
    const first = claims.companies[0]?.companyId ?? null;
    setActive(first);
    if (first) setActiveCompanyId(first);
  }

  function logout() {
    clearToken();
    setUser(null);
    setActive(null);
    router.push("/login");
  }

  function switchCompany(companyId: number) {
    setActive(companyId);
    setActiveCompanyId(companyId);
  }

  return (
    <AuthContext.Provider value={{ user, activeCompanyId, isLoading, login, logout, switchCompany }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

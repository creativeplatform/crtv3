"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useLogin } from "@privy-io/react-auth";

type AuthErrorContextValue = {
  login: () => void;
  authError: Error | null;
  clearAuthError: () => void;
};

const AuthErrorContext = createContext<AuthErrorContextValue | null>(null);

export function AuthErrorProvider({ children }: { children: ReactNode }) {
  const [authError, setAuthError] = useState<Error | null>(null);
  const { login } = useLogin({
    onComplete: () => setAuthError(null),
    onError: (error: unknown) => {
      setAuthError(error instanceof Error ? error : new Error(String(error)));
    },
  });

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthErrorContext.Provider value={{ login, authError, clearAuthError }}>
      {children}
    </AuthErrorContext.Provider>
  );
}

export function useAuthErrorContext() {
  const ctx = useContext(AuthErrorContext);
  if (!ctx) {
    throw new Error("useAuthErrorContext must be used within AuthErrorProvider");
  }
  return ctx;
}

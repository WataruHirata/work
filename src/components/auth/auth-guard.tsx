import type { ReactNode } from "react";

/** @deprecated Entry pages are public; admin routes use server-side access checks. */
export function AuthGuard({ children }: { children: ReactNode }) {
  return children;
}

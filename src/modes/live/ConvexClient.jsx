import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

export const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

export function LiveProviders({ children }) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}

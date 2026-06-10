import type { AuthedUser } from "./auth";

// Make the authenticated user available on every request after requireAuth.
declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export {};

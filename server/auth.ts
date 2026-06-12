import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, userClinicAccess, type Role } from "../shared/schema";
import { audit } from "./audit";

// Session shape. The session stores only the user id, the user record and its
// authorized clinics are loaded per request.
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export interface AuthedUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  title: string | null;
  homeClinicId: number | null;
  clinicIds: number[];
}

export async function loadUser(userId: number): Promise<AuthedUser | null> {
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!row || !row.isActive) return null;
  const access = await db
    .select({ clinicId: userClinicAccess.clinicId })
    .from(userClinicAccess)
    .where(eq(userClinicAccess.userId, userId));
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role as Role,
    title: row.title,
    homeClinicId: row.homeClinicId,
    clinicIds: access.map((a) => a.clinicId),
  };
}

// Attaches the authed user to the request, or 401 when there is no session.
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.session.userId) return res.status(401).json({ error: "Not signed in" });
  const user = await loadUser(req.session.userId);
  if (!user) return res.status(401).json({ error: "Session expired" });
  req.user = user;
  next();
}

// Role gate. Pass the roles allowed to reach the route.
export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Not signed in" });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient role" });
    }
    next();
  };
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const row = await db.query.users.findFirst({
      where: eq(users.email, String(email).toLowerCase()),
    });
    if (!row || !row.isActive || !bcrypt.compareSync(password, row.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    req.session.userId = row.id;
    await audit(req, { action: "login", entityType: "user", entityId: row.id });
    const user = await loadUser(row.id);
    res.json({ user });
  });

  app.post("/api/auth/logout", async (req, res) => {
    if (req.session.userId) {
      await audit(req, {
        action: "logout",
        entityType: "user",
        entityId: req.session.userId,
      });
    }
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) return res.json({ user: null });
    const user = await loadUser(req.session.userId);
    res.json({ user });
  });

  // Live username verification, the EndoVision login affordance: as the operator
  // types their email the form confirms the matching staff member by name and
  // role. This intentionally reveals whether an address is a known account, the
  // accepted trade-off for an internal, single-tenant clinic EDR; it returns no
  // credential material and never touches the password. Debounced client side.
  app.get("/api/auth/check-username", async (req, res) => {
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email || email.length < 3) return res.json({ exists: false });
    const row = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!row || !row.isActive) return res.json({ exists: false });
    res.json({ exists: true, fullName: row.fullName, role: row.role, title: row.title });
  });
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

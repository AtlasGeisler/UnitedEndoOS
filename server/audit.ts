import { db } from "./db";
import { auditLogs } from "../shared/schema";
import type { Request } from "express";

// Every PHI read and write appends an audit row. The detail object carries only
// non-PHI context (counts, ids, action metadata), never patient identifiers.
export async function audit(
  req: Request,
  params: {
    action: string;
    entityType: string;
    entityId?: string | number;
    clinicId?: number;
    detail?: Record<string, unknown>;
  },
) {
  const userId = req.session?.userId ?? null;
  await db.insert(auditLogs).values({
    userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId != null ? String(params.entityId) : null,
    clinicId: params.clinicId ?? null,
    sourceIp: req.ip ?? null,
    detail: params.detail ?? null,
  });
}

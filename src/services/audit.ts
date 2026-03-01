import { prisma } from "../lib/prisma";
import { AuditEvent } from "@prisma/client";

// Append-only audit log writer — never update or delete AuditLog records
export async function writeAuditLog(
  event: AuditEvent,
  actor: string,
  proposalId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      event,
      actor,
      proposalId: proposalId ?? null,
      metadata: metadata ?? null,
    },
  });
}

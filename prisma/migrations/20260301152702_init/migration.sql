-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'AUTO_EXECUTED', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'VETOED', 'EXECUTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('APPROVED', 'REJECTED', 'VETOED');

-- CreateEnum
CREATE TYPE "AuditEvent" AS ENUM ('PROPOSED', 'AUTO_EXECUTED', 'APPROVAL_SENT', 'APPROVED', 'REJECTED', 'VETOED', 'EXECUTED', 'FAILED', 'INCIDENT_DECLARED', 'HOTFIX_APPLIED', 'ARTIFACT_GENERATED');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "HotfixStatus" AS ENUM ('PENDING', 'APPLIED', 'REJECTED');

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "ticketTitle" TEXT NOT NULL,
    "ticketDescription" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "reporter" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "diff" TEXT NOT NULL,
    "filesToModify" TEXT[],
    "risks" TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "whatIDidntDo" TEXT NOT NULL,
    "testCoverageAffected" BOOLEAN NOT NULL,
    "tier" "Tier" NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskReasons" TEXT[],
    "failSafeTriggered" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT,
    "event" "AuditEvent" NOT NULL,
    "actor" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "logs" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "reporter" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hotfix" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "diff" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "blastRadius" TEXT NOT NULL,
    "status" "HotfixStatus" NOT NULL DEFAULT 'PENDING',
    "appliedBy" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hotfix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Approval_proposalId_key" ON "Approval"("proposalId");

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotfix" ADD CONSTRAINT "Hotfix_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

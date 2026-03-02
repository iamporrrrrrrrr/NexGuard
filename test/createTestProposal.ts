import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createTestProposal() {
  try {
    const proposal = await prisma.proposal.create({
      data: {
        id: "test-123",
        ticketTitle: "Add logging to authentication module",
        ticketDescription: "Add debug logging to track authentication flow",
        repo: "nexguard-org/demo-app",
        reporter: "alice",
        summary: "Added console.log statements to track user login flow",
        diff: `diff --git a/src/auth.ts b/src/auth.ts
index 1234567..abcdefg 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,6 +10,7 @@ export function login(username: string, password: string) {
+  console.log('User attempting login:', username);
   const user = findUser(username);
   if (!user) {
+    console.log('User not found:', username);
     return null;
   }`,
        filesToModify: ["src/auth.ts"],
        risks: ["Logging may expose sensitive usernames"],
        confidence: 0.95,
        whatIDidntDo: "Did not add password logging (security risk)",
        testCoverageAffected: false,
        tier: "GREEN",
        riskScore: 15,
        riskReasons: ["Low impact change", "Only adds logging", "No business logic modified"],
        status: "PENDING",
      },
    });

    console.log("✓ Test proposal created successfully!");
    console.log("ID:", proposal.id);
    console.log("\nTest it with:");
    console.log(`  curl http://localhost:3000/diff/${proposal.id} | jq .`);
  } catch (error) {
    console.error("Error creating test proposal:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestProposal();

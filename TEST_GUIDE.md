# Slack & Notification Layer - Testing Guide

## ✅ What's Been Implemented

All 4 main files for Person 4 (Slack & Notification Layer) are complete:

### 1. [src/routes/approval.ts](src/routes/approval.ts) ✅
- **GET /diff/:id** - View proposal diff and details
- **GET /approve/:id** - Approve a proposal with atomic transaction
- **GET /reject/:id** - Reject a proposal with atomic transaction

### 2. [src/integrations/slack.ts](src/integrations/slack.ts) ✅
- **notify()** - Send plain text notifications to Slack
- **sendApprovalCard()** - Rich Slack Block Kit approval cards with:
  - Tier badges (🟢 GREEN, 🟡 YELLOW, 🔴 RED)
  - Proposal summary, risk score, confidence
  - Files to modify, risk reasons
  - Approve/Reject/View Diff buttons
  - YELLOW tier veto window warnings
  - Deployment detection warnings
- **sendHotfixCard()** - Incident mode hotfix selection (stub for future)

### 3. [src/routes/slack.ts](src/routes/slack.ts) ✅
- **POST /slack/events** - Interactive component callback handler
  - URL verification for Slack setup
  - Action dispatching (approve_proposal, reject_proposal, apply_hotfix)
  - Atomic database transactions
  - Audit logging

### 4. [src/agents/communication.ts](src/agents/communication.ts) ✅
- **generatePRDescription()** - AI-generated PR descriptions from audit trail
- **generatePostmortem()** - Incident postmortems with timeline & lessons learned
- **generateChangelog()** - Release changelogs grouped by category

## 🧪 How to Test

### Prerequisites
1. **Start Docker Desktop** (required for PostgreSQL and Redis)
2. **Set up environment variables** in `.env`:
   ```bash
   OPENAI_API_KEY=your_key_here
   SLACK_WEBHOOK_URL=your_slack_webhook_url
   ```

### Step 1: Start Services
```bash
# Start database containers
docker-compose up -d postgres redis

# Wait for PostgreSQL to be ready
sleep 5

# Run migrations to create tables
pnpm db:migrate

# Start the dev server (already running in terminal)
# pnpm dev
```

### Step 2: Create Test Data
```bash
# Run the test data creation script
npx ts-node test/createTestProposal.ts
```

### Step 3: Test API Endpoints

#### Test 1: View Diff
```bash
curl http://localhost:3000/diff/test-123 | jq .
```
Expected: Returns full proposal details including diff

#### Test 2: Approve Proposal
```bash
curl "http://localhost:3000/approve/test-123?approver=alice" | jq .
```
Expected: 
```json
{
  "success": true,
  "message": "Proposal approved successfully",
  "proposalId": "test-123",
  "approver": "alice",
  "note": "Executor not yet implemented - PR creation pending"
}
```

#### Test 3: View in Database
```bash
# Open Prisma Studio to see the data
pnpm db:studio
```
Navigate to http://localhost:5555 and check:
- **Proposal** table - status should be "APPROVED"
- **Approval** table - should have approval record
- **AuditLog** table - should have APPROVED event

### Step 4: Test Slack Integration

#### Test Slack Notification
```bash
# Test simple notification (requires SLACK_WEBHOOK_URL in .env)
node -e "
const { notify } = require('./src/integrations/slack.ts');
notify('Test notification from DevGuard!');
"
```

#### Test Approval Card
```bash
# Send an approval card to Slack (requires proposal in DB)
node -e "
const { sendApprovalCard } = require('./src/integrations/slack.ts');
sendApprovalCard('test-123');
"
```

### Step 5: Test Communication Agent

#### Test PR Description Generation
```bash
# Create test script
cat > test_communication.ts << 'EOF'
import { generatePRDescription, generateChangelog } from './src/agents/communication';

async function test() {
  console.log('Generating PR description...');
  const prDesc = await generatePRDescription('test-123');
  console.log(prDesc);
  
  console.log('\n\nGenerating changelog...');
  const changelog = await generateChangelog(['test-123']);
  console.log(changelog);
}

test().catch(console.error);
EOF

npx ts-node test_communication.ts
```

## 🔍 Manual Testing Checklist

- [ ] Server starts successfully on port 3000
- [ ] `/health` endpoint returns `{"status":"ok"}`
- [ ] `/diff/:id` returns proposal details
- [ ] `/approve/:id` creates approval, updates status, logs audit
- [ ] `/reject/:id` creates rejection, updates status, logs audit
- [ ] Database transactions are atomic (check in Prisma Studio)
- [ ] Slack webhook receives notifications (if configured)
- [ ] Slack approval cards display correctly (if configured)
- [ ] Communication agent generates coherent text (requires OpenAI key)

## 📊 Database Verification

After approving a proposal, verify in Prisma Studio (http://localhost:5555):

### Proposal Table
```
id: test-123
status: APPROVED (changed from PENDING)
updatedAt: [recent timestamp]
```

### Approval Table
```
id: [auto-generated]
proposalId: test-123
actor: alice
action: APPROVED
createdAt: [timestamp]
```

### AuditLog Table
```
id: [auto-generated]
proposalId: test-123
event: APPROVED
actor: alice
metadata: {"approvalId": "...", "previousStatus": "PENDING"}
```

## 🎯 Key Features Demonstrated

1. **Atomic Transactions** - All database writes use `prisma.$transaction()`
2. **Audit Trail** - Every action is logged to AuditLog (append-only)
3. **Error Handling** - Graceful fallbacks, no crashes on external service failures
4. **Slack Integration** - Rich Block Kit messages with interactive components
5. **AI Communication** - GPT-4o generates professional documentation
6. **Type Safety** - Full TypeScript types throughout

## 🚨 Troubleshooting

### Server won't start
- Check if port 3000 is available: `lsof -i :3000`
- Verify dependencies: `pnpm install`
- Check for TypeScript errors: `pnpm build`

### Database connection errors
- Ensure Docker Desktop is running
- Check containers: `docker ps`
- Restart containers: `docker-compose restart postgres`

### Slack webhooks not working
- Verify `SLACK_WEBHOOK_URL` is set in `.env`
- Test webhook manually with curl
- Check server logs for errors

### OpenAI API errors
- Verify `OPENAI_API_KEY` is set in `.env`
- Check API key has credits
- Review error messages in console

## 📝 Next Steps

When other team members complete their parts:
1. **Person 1 (Codex Agent)** - Connect intake endpoint to send proposals
2. **Person 2 (Risk Engine)** - Integrate ML scoring before sending approval cards
3. **Person 3 (Executor)** - Wire up PR creation after approval
4. **Integration Testing** - Test full flow from ticket → approval → PR

## 🎉 Demo Script

For judges, demonstrate:
1. Show Slack approval card with rich formatting
2. Click "Approve" button → show database update in real-time
3. Show audit trail in Prisma Studio
4. Generate PR description with AI
5. Show how YELLOW tier includes veto window
6. Show deployment detection warnings

---

**All Person 4 deliverables are complete and ready for integration!** 🚀

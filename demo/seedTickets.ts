const BASE_URL = process.env.DEVGUARD_APP_URL ?? "http://localhost:3000";

async function seed() {
  // Scenario A — GREEN: low-blast, documentation change
  await fetch(`${BASE_URL}/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Add docstrings to orders module",
      description: "Document all public functions in orders.py with Google-style docstrings",
      repo: "devguard-org/demo-app",
      reporter: "alice",
    }),
  });

  // Scenario B — YELLOW: medium-blast, refactor with moderate risk
  await fetch(`${BASE_URL}/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Refactor user authentication middleware",
      description: "Extract auth logic into a reusable middleware, update 6 route files to use the new auth middleware, add refresh token rotation support",
      repo: "devguard-org/demo-app",
      reporter: "dana",
    }),
  });

  // Scenario C — RED: high-blast, payment SDK migration
  await fetch(`${BASE_URL}/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Migrate payments from Stripe v2 to v3 SDK",
      description: "Update all Stripe API calls to use the new v3 SDK including webhook handling",
      repo: "devguard-org/demo-app",
      reporter: "bob",
    }),
  });

  // Scenario C — Incident: production 500 errors
  await fetch(`${BASE_URL}/incident`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: "orders-api returning 500 errors spiking since last deployment",
      logs: "sqlalchemy.exc.OperationalError: no such column: orders.user_id_new",
      repo: "devguard-org/demo-app",
      reporter: "charlie",
    }),
  });

  // Scenario D — Jira Webhook (simulates what Jira Automation would send)
  console.log("Sending Jira webhook scenario...");
  const jiraRes = await fetch(`${BASE_URL}/intake/jira`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webhookEvent: "jira:issue_created",
      issue: {
        key: "DEV-142",
        self: "https://your-org.atlassian.net/rest/api/3/issue/DEV-142",
        fields: {
          summary: "Add rate limiting to public API endpoints",
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Implement rate limiting (100 req/min per API key) on all /api/v1/* routes. Use Redis sliding window. Update 4 route files and add a new middleware."
                  }
                ]
              }
            ]
          },
          project: { key: "DEV" },
          issuetype: { name: "Task" },
          priority: { name: "High" },
          reporter: { displayName: "eve", emailAddress: "eve@company.com" },
          creator: { displayName: "eve" },
          labels: ["repo:devguard-org/demo-app", "backend", "security"],
          components: [{ name: "API Gateway" }],
        },
      },
    }),
  });
  const jiraData = await jiraRes.json();
  console.log(`Jira webhook response (${jiraRes.status}):`, JSON.stringify(jiraData, null, 2));

  console.log("Demo scenarios seeded.");
}

seed().catch(console.error);

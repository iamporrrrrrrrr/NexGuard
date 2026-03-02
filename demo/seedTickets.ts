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

  console.log("Demo scenarios seeded.");
}

seed().catch(console.error);

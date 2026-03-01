import express, { Request, Response, NextFunction, type Express } from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import intakeRouter from "./routes/intake";
import incidentRouter from "./routes/incident";
import approvalRouter from "./routes/approval";
import auditRouter from "./routes/audit";
import slackRouter from "./routes/slack";

const app: Express = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For Slack payloads

// Mount routes
app.use("/intake", intakeRouter);
app.use("/incident", incidentRouter);
app.use("/", approvalRouter);
app.use("/audit", auditRouter);
app.use("/slack", slackRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Global error-handling middleware — catches unhandled errors from all routes
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[global] Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    ...(process.env.NODE_ENV !== "production" && { detail: err.message }),
  });
});

app.listen(PORT, () => {
  console.log(`DevGuard listening on port ${PORT}`);
});

export default app;

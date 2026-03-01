import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

// TODO: import routes
// import intakeRouter from "./routes/intake";
// import incidentRouter from "./routes/incident";
import approvalRouter from "./routes/approval";
// import auditRouter from "./routes/audit";
import slackRouter from "./routes/slack";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For Slack payloads

// TODO: mount routes
// app.use("/intake", intakeRouter);
// app.use("/incident", incidentRouter);
app.use("/", approvalRouter);
// app.use("/audit", auditRouter);
app.use("/slack", slackRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`DevGuard listening on port ${PORT}`);
});

export default app;

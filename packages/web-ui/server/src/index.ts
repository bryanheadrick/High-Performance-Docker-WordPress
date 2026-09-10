import express, { type Express } from "express";
import { createSitesRouter } from "./routes/sites.js";
import { createStackRouter } from "./routes/stack.js";

export function createApp(repoRoot: string): Express {
  const app = express();
  app.use(express.json());
  app.use("/api/sites", createSitesRouter(repoRoot));
  app.use("/api/stack", createStackRouter(repoRoot));
  return app;
}

export function startServer(repoRoot: string, port = 4321): void {
  const app = createApp(repoRoot);
  app.listen(port, "127.0.0.1", () => {
    console.log(`wpstack web UI API listening on http://127.0.0.1:${port}`);
  });
}

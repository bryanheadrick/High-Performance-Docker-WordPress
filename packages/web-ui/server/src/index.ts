import express, { type Express } from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSitesRouter } from "./routes/sites.js";
import { createStackRouter } from "./routes/stack.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp(repoRoot: string): Express {
  const app = express();
  app.use(express.json());
  app.use("/api/sites", createSitesRouter(repoRoot));
  app.use("/api/stack", createStackRouter(repoRoot));

  const clientDist = join(__dirname, "..", "..", "client", "dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(join(clientDist, "index.html"));
  });

  return app;
}

export function startServer(repoRoot: string, port = 4321): void {
  const app = createApp(repoRoot);
  app.listen(port, "127.0.0.1", () => {
    console.log(`wpstack web UI listening on http://127.0.0.1:${port}`);
  });
}

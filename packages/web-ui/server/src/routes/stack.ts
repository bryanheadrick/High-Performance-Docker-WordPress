import { Router } from "express";
import { startStack, stopStack, restartStack, getStackStatus } from "@wpstack/core";

export function createStackRouter(repoRoot: string): Router {
  const router = Router();

  router.get("/status", async (_req, res) => {
    const result = await getStackStatus(repoRoot);
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json(result.data);
  });

  router.post("/start", async (_req, res) => {
    const result = await startStack(repoRoot);
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json(result.data);
  });

  router.post("/stop", async (_req, res) => {
    const result = await stopStack(repoRoot);
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json(result.data);
  });

  router.post("/restart", async (_req, res) => {
    const result = await restartStack(repoRoot);
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json(result.data);
  });

  return router;
}

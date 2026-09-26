import { Router } from "express";
import { listSites, getSite, createSite, removeSite } from "@wpstack/core";

export function createSitesRouter(repoRoot: string): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const result = await listSites(repoRoot);
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json(result.data);
  });

  router.get("/:domain", async (req, res) => {
    const result = await getSite(repoRoot, req.params.domain);
    if (!result.success) {
      const status = result.error.code === "SITE_NOT_FOUND" ? 404 : 500;
      res.status(status).json({ error: result.error });
      return;
    }
    res.json(result.data);
  });

  router.post("/", async (req, res) => {
    const result = await createSite(repoRoot, req.body);
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.status(201).json(result.data);
  });

  router.delete("/:domain", async (req, res) => {
    const result = await removeSite(repoRoot, req.params.domain);
    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }
    res.json(result.data);
  });

  return router;
}

export interface SiteInfo {
  domain: string;
  hasNginxConfig: boolean;
  hasSsl: boolean;
  hasWordPress: boolean;
  dbName: string | null;
  url: string;
}

export interface CreateSiteInput {
  domain: string;
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;
  adminUser?: string;
  adminPassword?: string;
  adminEmail?: string;
}

export interface ContainerStatus {
  name: string;
  state: string;
  status: string;
}

async function handle<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message ?? "Request failed");
  }
  return body as T;
}

export const api = {
  listSites: (): Promise<SiteInfo[]> => fetch("/api/sites").then((r) => handle(r)),

  createSite: (
    input: CreateSiteInput
  ): Promise<{ domain: string; url: string; warnings?: string[] }> =>
    fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => handle(r)),

  removeSite: (domain: string): Promise<{ domain: string }> =>
    fetch(`/api/sites/${encodeURIComponent(domain)}`, { method: "DELETE" }).then((r) =>
      handle(r)
    ),

  stackStatus: (): Promise<ContainerStatus[]> =>
    fetch("/api/stack/status").then((r) => handle(r)),

  stackStart: (): Promise<{ started: boolean }> =>
    fetch("/api/stack/start", { method: "POST" }).then((r) => handle(r)),

  stackStop: (): Promise<{ stopped: boolean }> =>
    fetch("/api/stack/stop", { method: "POST" }).then((r) => handle(r)),

  stackRestart: (): Promise<{ restarted: boolean }> =>
    fetch("/api/stack/restart", { method: "POST" }).then((r) => handle(r)),
};

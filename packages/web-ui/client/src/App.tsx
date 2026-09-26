import { useEffect, useState } from "react";
import { api, type SiteInfo, type ContainerStatus, type CreateSiteInput } from "./api";
import { SiteList } from "./components/SiteList";
import { NewSiteForm } from "./components/NewSiteForm";
import { StackPanel } from "./components/StackPanel";

export function App() {
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [containers, setContainers] = useState<ContainerStatus[]>([]);
  const [creating, setCreating] = useState(false);
  const [removingDomain, setRemovingDomain] = useState<string | null>(null);
  const [stackBusy, setStackBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshSites() {
    setSites(await api.listSites());
  }

  async function refreshStack() {
    try {
      setContainers(await api.stackStatus());
    } catch {
      setContainers([]);
    }
  }

  useEffect(() => {
    refreshSites().catch((e) => setError(e.message));
    refreshStack();
  }, []);

  async function handleCreate(input: CreateSiteInput) {
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.createSite(input);
      if (result.warnings && result.warnings.length > 0) {
        setNotice(result.warnings.join(" "));
      }
      await refreshSites();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRemove(domain: string) {
    setRemovingDomain(domain);
    setError(null);
    try {
      await api.removeSite(domain);
      await refreshSites();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRemovingDomain(null);
    }
  }

  async function withStackBusy(action: () => Promise<unknown>) {
    setStackBusy(true);
    setError(null);
    try {
      await action();
      await refreshStack();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStackBusy(false);
    }
  }

  return (
    <main>
      <h1>wpstack Site Manager</h1>
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}
      <StackPanel
        containers={containers}
        busy={stackBusy}
        onStart={() => withStackBusy(api.stackStart)}
        onStop={() => withStackBusy(api.stackStop)}
        onRestart={() => withStackBusy(api.stackRestart)}
      />
      <SiteList sites={sites} onRemove={handleRemove} removingDomain={removingDomain} />
      <NewSiteForm onCreate={handleCreate} creating={creating} />
    </main>
  );
}

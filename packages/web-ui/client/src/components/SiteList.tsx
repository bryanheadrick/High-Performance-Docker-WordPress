import type { SiteInfo } from "../api";
import { SiteCard } from "./SiteCard";

interface Props {
  sites: SiteInfo[];
  onRemove: (domain: string) => void;
  removingDomain: string | null;
}

export function SiteList({ sites, onRemove, removingDomain }: Props) {
  if (sites.length === 0) {
    return <p>No sites yet. Create one below.</p>;
  }

  return (
    <div className="site-list">
      {sites.map((site) => (
        <SiteCard
          key={site.domain}
          site={site}
          onRemove={onRemove}
          removing={removingDomain === site.domain}
        />
      ))}
    </div>
  );
}

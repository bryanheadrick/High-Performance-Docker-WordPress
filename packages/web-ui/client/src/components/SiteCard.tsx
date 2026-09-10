import type { SiteInfo } from "../api";

interface Props {
  site: SiteInfo;
  onRemove: (domain: string) => void;
  removing: boolean;
}

export function SiteCard({ site, onRemove, removing }: Props) {
  return (
    <div className="site-card">
      <h3>{site.domain}</h3>
      <p>
        <a href={site.url} target="_blank" rel="noreferrer">
          {site.url}
        </a>
      </p>
      <ul>
        <li>WordPress: {site.hasWordPress ? "installed" : "not installed"}</li>
        <li>SSL: {site.hasSsl ? "yes" : "no"}</li>
        <li>Nginx config: {site.hasNginxConfig ? "yes" : "no"}</li>
        <li>Database: {site.dbName ?? "n/a"}</li>
      </ul>
      <button
        disabled={removing}
        onClick={() => {
          if (window.confirm(`Remove ${site.domain}? This cannot be undone.`)) {
            onRemove(site.domain);
          }
        }}
      >
        {removing ? "Removing..." : "Remove"}
      </button>
    </div>
  );
}

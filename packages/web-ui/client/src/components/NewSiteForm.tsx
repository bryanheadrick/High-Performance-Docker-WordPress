import { useState, type FormEvent } from "react";
import type { CreateSiteInput } from "../api";

interface Props {
  onCreate: (input: CreateSiteInput) => void;
  creating: boolean;
}

export function NewSiteForm({ onCreate, creating }: Props) {
  const [domain, setDomain] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!domain) return;
    onCreate({ domain, adminEmail: adminEmail || undefined });
    setDomain("");
    setAdminEmail("");
  }

  return (
    <form onSubmit={handleSubmit} className="new-site-form">
      <h3>New Site</h3>
      <label>
        Domain
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="mysite.local"
          required
        />
      </label>
      <label>
        Admin email
        <input
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          placeholder="admin@mysite.local"
        />
      </label>
      <button type="submit" disabled={creating}>
        {creating ? "Creating..." : "Create Site"}
      </button>
    </form>
  );
}

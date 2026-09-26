import { describe, it, expect, vi } from "vitest";
import { formatSiteList } from "../src/commands/site.js";
import type { SiteInfo } from "@wpstack/core";

describe("formatSiteList", () => {
  it("returns a placeholder line when there are no sites", () => {
    const output = formatSiteList([]);
    expect(output).toContain("No sites found");
  });

  it("formats one line per site with domain and status markers", () => {
    const sites: SiteInfo[] = [
      {
        domain: "example.local",
        hasNginxConfig: true,
        hasSsl: true,
        hasWordPress: true,
        dbName: "example_local",
        url: "https://example.local",
      },
    ];

    const output = formatSiteList(sites);

    expect(output).toContain("example.local");
    expect(output).toContain("https://example.local");
  });
});

import { describe, it, expect } from "vitest";
import { resolveWpContainerPath } from "../src/wpCli.js";

describe("resolveWpContainerPath", () => {
  it("returns the default WordPress path when domain is null", () => {
    expect(resolveWpContainerPath(null)).toBe("/var/www/html");
  });

  it("returns the multi-site path for a given domain", () => {
    expect(resolveWpContainerPath("example.local")).toBe(
      "/var/www/html/sites/example.local"
    );
  });
});

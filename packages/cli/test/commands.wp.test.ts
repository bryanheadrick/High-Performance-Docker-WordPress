import { describe, it, expect } from "vitest";
import { parseWpArgs } from "../src/commands/wp.js";

describe("parseWpArgs", () => {
  it("returns no domain when no site flag is given", () => {
    expect(parseWpArgs(["plugin", "list"])).toEqual({
      domain: undefined,
      args: ["plugin", "list"],
    });
  });

  it("reads a domain from the space-separated form", () => {
    expect(parseWpArgs(["--site", "mysite.local", "plugin", "list"])).toEqual({
      domain: "mysite.local",
      args: ["plugin", "list"],
    });
  });

  it("reads a domain from the equals form", () => {
    expect(parseWpArgs(["--site=mysite.local", "plugin", "list"])).toEqual({
      domain: "mysite.local",
      args: ["plugin", "list"],
    });
  });

  it("leaves wp-cli flags after the subcommand untouched", () => {
    expect(parseWpArgs(["--site", "mysite.local", "post", "list", "--format=json"])).toEqual({
      domain: "mysite.local",
      args: ["post", "list", "--format=json"],
    });
  });

  it("does not consume a site flag that appears after the wp-cli subcommand", () => {
    expect(parseWpArgs(["option", "get", "--site=other.local"])).toEqual({
      domain: undefined,
      args: ["option", "get", "--site=other.local"],
    });
  });

  it("keeps the last domain when the flag is repeated", () => {
    expect(
      parseWpArgs(["--site", "first.local", "--site", "second.local", "plugin", "list"])
    ).toEqual({
      domain: "second.local",
      args: ["plugin", "list"],
    });
  });

  it("errors when the space-separated form has no value", () => {
    expect(parseWpArgs(["--site"]).error).toMatch(/requires a domain/);
  });

  it("errors when the space-separated form is followed by another flag", () => {
    expect(parseWpArgs(["--site", "--format=json"]).error).toMatch(/requires a domain/);
  });

  it("errors when the equals form has an empty value", () => {
    expect(parseWpArgs(["--site="]).error).toMatch(/requires a domain/);
  });
});

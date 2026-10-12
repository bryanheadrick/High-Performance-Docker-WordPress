import { runWpCli } from "@wpstack/core";
import { requireRepoRoot } from "../repo.js";

const SITE_FLAG = "--site";

export interface ParsedWpArgs {
  domain?: string;
  args: string[];
  error?: string;
}

export function parseWpArgs(rawArgs: string[]): ParsedWpArgs {
  let domain: string | undefined;
  let index = 0;

  while (index < rawArgs.length) {
    const arg = rawArgs[index];

    if (arg === SITE_FLAG) {
      const value = rawArgs[index + 1];

      if (!value || value.startsWith("-")) {
        return { args: [], error: `${SITE_FLAG} requires a domain, e.g. ${SITE_FLAG} mysite.local` };
      }

      domain = value;
      index += 2;
      continue;
    }

    if (arg.startsWith(`${SITE_FLAG}=`)) {
      const value = arg.slice(SITE_FLAG.length + 1);

      if (!value) {
        return { args: [], error: `${SITE_FLAG} requires a domain, e.g. ${SITE_FLAG}=mysite.local` };
      }

      domain = value;
      index += 1;
      continue;
    }

    break;
  }

  return { domain, args: rawArgs.slice(index) };
}

export async function runWpCommand(rawArgs: string[]): Promise<void> {
  const parsed = parseWpArgs(rawArgs);

  if (parsed.error) {
    console.error(`Error: ${parsed.error}`);
    process.exit(1);
  }

  requireRepoRoot();

  const result = await runWpCli(process.cwd(), parsed.args, { domain: parsed.domain });

  if (!result.success) {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.data.exitCode);
}

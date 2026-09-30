import { runWpCli } from "@wpstack/core";

export async function runWpCommand(args: string[]): Promise<void> {
  const result = await runWpCli(process.cwd(), args);

  if (!result.success) {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.data.exitCode);
}

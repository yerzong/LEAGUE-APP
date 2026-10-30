// Entry point. Guard: without a bot token (and the rest of its config) the
// process logs why and exits cleanly, so `pnpm dev` keeps the API and web
// running (docs/specs/m07 §1).

import { resolveConfig } from './config.js';
import { startBot } from './bot.js';

async function main(): Promise<void> {
  const { config, reason } = resolveConfig();
  if (!config) {
    console.info(`[bot] disabled: ${reason ?? 'not configured'}. The rest of the stack runs.`);
    return;
  }
  await startBot(config);
  console.info('[bot] connected and commands registered.');
}

await main();

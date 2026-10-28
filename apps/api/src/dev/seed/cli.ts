// Entry point of `pnpm seed:demo` and `pnpm seed:reset` (apps/api/.env).
// Development only: not part of the API build (tsconfig.build.json), and the
// guard refuses anything but penta-dev with SEED_ENABLED=true.
import { DEFAULT_DEMO_PASSWORD, DEMO_STAFF_EMAIL } from './demo-data.js';
import { apiIsRunning, openSeedContext } from './context.js';
import { assertSeedAllowed, SeedRefusedError } from './guard.js';
import { seedDemo } from './seed-demo.js';
import { seedReset } from './seed-reset.js';

const log = (line: string) => {
  process.stdout.write(`${line}\n`);
};

async function main(command: string | undefined): Promise<void> {
  if (command !== 'demo' && command !== 'reset') throw new Error('usage: cli.ts demo|reset');
  assertSeedAllowed(process.env);
  const site = process.env.SEED_SITE_URL ?? 'http://localhost:3000';
  if (
    command === 'demo' &&
    (await apiIsRunning(process.env.SEED_API_URL ?? 'http://localhost:4000'))
  )
    throw new SeedRefusedError(
      'stop the API first (its check-in sweeper would close the league rounds the seed replays)',
    );

  const ctx = await openSeedContext(process.env);
  try {
    if (command === 'reset') {
      const r = await seedReset(ctx);
      log(
        `Demo borrada: ${String(r.tournaments)} torneos, ${String(r.teams)} equipos, ` +
          `${String(r.deletedAccounts)} cuentas borradas, ${String(r.anonymizedAccounts)} anonimizadas ` +
          '(aparecen en la auditoría, que no se borra).',
      );
      return;
    }
    const password = process.env.SEED_DEMO_PASSWORD ?? DEFAULT_DEMO_PASSWORD;
    const s = await seedDemo(ctx, password, log);
    log('');
    log(
      `Listo: ${String(s.players)} jugadores, ${String(s.teams)} equipos, ${String(s.tournaments.length)} torneos.`,
    );
    for (const t of s.tournaments)
      log(`  ${t.name} [${t.status}${t.created ? '' : ', ya existía'}]  ${site}/torneos/${t.slug}`);
    log('');
    log(`Contraseña de todas las cuentas demo: ${password}`);
    log(`  Staff (super_admin): ${DEMO_STAFF_EMAIL}  →  ${site}/admin/torneos`);
    for (const c of s.captains) log(`  Capitán ${c.team}: ${c.email}`);
  } finally {
    await ctx.close();
  }
}

main(process.argv[2]).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

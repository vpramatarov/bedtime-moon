// Runs the real production build exactly once before the whole test run, in the main process --
// not inside a per-file beforeAll. Vitest runs test files in parallel workers by default, and two
// files each shelling out to `npm run build` against the same dist/ raced and corrupted each
// other's output (one build's `vite build` truncating dist/ mid-read by another's
// generate-manifest.mjs). A single global build removes the race and the duplicate work.
import { execSync } from 'node:child_process';

export default function setup() {
  run('npm run build', {});
  // TKT-0007 AC #2 -- a second, bare build (no SW pass, no node scripts) into a distinct outDir,
  // solely to prove Vite's own %BASE_URL% HTML templating resolves correctly under a non-root
  // base. Everything else about base-path support is covered by unit tests (see
  // test/sw-manifest-utils.test.ts, test/night-strip.test.ts, test/register-sw.test.ts).
  run('npx vite build --outDir dist-basepath-test', { BASE_PATH: '/base-test/' });
}

function run(command: string, envOverrides: Record<string, string>) {
  try {
    execSync(command, { cwd: process.cwd(), stdio: 'pipe', env: { ...process.env, ...envOverrides } });
  } catch (error) {
    const output = error instanceof Error && 'stdout' in error ? String((error as { stdout?: unknown }).stdout) : '';
    const stderr = error instanceof Error && 'stderr' in error ? String((error as { stderr?: unknown }).stderr) : '';
    throw new Error(`${command} failed in global test setup:\n${output}\n${stderr}`);
  }
}

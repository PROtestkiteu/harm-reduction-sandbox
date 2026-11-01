import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/**
 * The version shown in the corner: major and minor from package.json, the
 * last digit the number of commits that touched this app, so every commit on
 * GitHub main moves it on by one. Without git (a zip download) package.json
 * alone decides.
 */
function appVersion(): string {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
  try {
    const count = execSync('git rev-list --count HEAD -- .', { cwd: new URL('.', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const [major, minor] = version.split('.');
    return /^\d+$/.test(count) ? `${major}.${minor}.${count}` : version;
  } catch {
    return version;
  }
}

/** One id per build: a running game compares it with version.json to notice a newer one. */
const BUILD = `${appVersion()}+${Date.now().toString(36)}`;

/** Writes version.json next to the page, read by running games (src/game/updates.ts). */
function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) });
    },
  };
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion()), __APP_BUILD__: JSON.stringify(BUILD) },
  plugins: [versionFile()],
  // In development the leaderboard runs on PHP's built-in server (server/board.php on port 5203).
  server: { port: 5199, strictPort: true, proxy: { '/api/board.php': { target: 'http://127.0.0.1:5203', rewrite: () => '/board.php' } } },
  preview: { port: 5199, strictPort: true },
  build: { target: 'es2022', outDir: 'dist' },
});

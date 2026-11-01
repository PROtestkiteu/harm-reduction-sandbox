import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

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

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  // In development the leaderboard runs on PHP's built-in server (server/board.php on port 5203).
  server: { port: 5199, strictPort: true, proxy: { '/api/board.php': { target: 'http://127.0.0.1:5203', rewrite: () => '/board.php' } } },
  preview: { port: 5199, strictPort: true },
  build: { target: 'es2022', outDir: 'dist' },
});

/**
 * Download the PostgREST binary used by the local stack and the end-to-end
 * tests (`npm run dev:local`, tests/e2e). It is the same server Supabase uses
 * for its REST API; it goes into backend/.tools/ (git-ignored).
 *
 *   npm run e2e:setup
 *
 * The release is pinned. GitHub does not publish a checksum next to the asset,
 * so the SHA-256 of what was downloaded is printed for you to compare with the
 * release page if you care to.
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = 'v16.4';
const here = dirname(fileURLToPath(import.meta.url));
const tools = join(here, '..', '.tools');
const target = join(tools, 'postgrest');

const assets = {
  'win32-x64': 'windows-x86-64.zip',
  'linux-x64': 'linux-static-x86-64.tar.xz',
  'linux-arm64': 'linux-static-aarch64.tar.xz',
  'darwin-x64': 'macos-x86-64.tar.xz',
  'darwin-arm64': 'macos-aarch64.tar.xz',
};
const suffix = assets[`${process.platform}-${process.arch}`];
if (!suffix) {
  console.error(`No PostgREST build is listed for ${process.platform}/${process.arch}.`);
  process.exit(1);
}

const binary = join(target, process.platform === 'win32' ? 'postgrest.exe' : 'postgrest');
if (existsSync(binary)) {
  const check = spawnSync(binary, ['--version'], { encoding: 'utf8' });
  if (check.status === 0) {
    console.log(`PostgREST already installed: ${check.stdout.trim()}`);
    process.exit(0);
  }
}

const url = `https://github.com/PostgREST/postgrest/releases/download/${VERSION}/postgrest-${VERSION}-${suffix}`;
console.log(`Downloading ${url}`);
const response = await fetch(url, { redirect: 'follow' });
if (!response.ok) {
  console.error(`Download failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}
const bytes = Buffer.from(await response.arrayBuffer());
console.log(`sha256 ${createHash('sha256').update(bytes).digest('hex')} (${(bytes.length / 1048576).toFixed(1)} MB)`);

mkdirSync(target, { recursive: true });
const archive = join(tools, `postgrest-${suffix}`);
writeFileSync(archive, bytes);
// bsdtar (Windows 10+, macOS) and GNU tar both read zip / tar.xz with -xf.
const extract = spawnSync('tar', ['-xf', archive, '-C', target], { stdio: 'inherit' });
rmSync(archive, { force: true });
if (extract.status !== 0) {
  console.error('Could not extract the archive; is `tar` available?');
  process.exit(1);
}

const check = spawnSync(binary, ['--version'], { encoding: 'utf8' });
if (check.status !== 0) {
  console.error('The downloaded binary did not run.');
  process.exit(1);
}
console.log(`Installed ${check.stdout.trim()} at ${binary}`);
void readFileSync;

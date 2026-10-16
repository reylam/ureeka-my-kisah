import { existsSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { chromium } from 'playwright-core';

const exe = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync);

function png(size) {
  const raw = Buffer.alloc((1 + size) * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x - size / 2, y - size / 2) / size;
      raw[y * (1 + size) + 1 + x] = Math.max(0, Math.min(255, 190 - d * 240 + ((x * 7 + y * 13) % 19)));
    }
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const file = process.env.TEMP + '\\pulmo-live-check.png';
writeFileSync(file, png(400));

const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.type() + ': ' + m.text().slice(0, 200)));
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url().slice(0, 120) + ' ' + r.failure()?.errorText));

await page.goto('https://paru-pintas.vercel.app/demo', { waitUntil: 'networkidle' });
const live = await page.getByText('Modelnya berjalan langsung').count();
const stand = await page.getByText('Belum ada model terlatih yang terhubung').count();
console.log('banner -> local model:', live, '| stand-in:', stand);

await page.locator('input[type=file]').setInputFiles(file);
await page.getByRole('button', { name: /Periksa X-ray ini/ }).click();
await page.waitForTimeout(6000);

console.log('has model result panel:', await page.getByText('Hasil model').count());
console.log('has stand-in panel:', await page.getByText('Contoh hasil').count());
console.log('risk meter:', await page.getByRole('meter', { name: 'Risk point' }).count());
console.log('status text:', (await page.locator('[aria-live=polite]').first().textContent())?.trim());
const alert = page.getByRole('alert');
console.log('alerts:', await alert.count(), (await alert.allTextContents()).join(' | ').slice(0, 300));
await page.screenshot({ path: process.env.TEMP + '\\pulmo-live-check-shot.png', fullPage: false });
console.log('errors:', JSON.stringify(errors.slice(0, 6)));
await browser.close();

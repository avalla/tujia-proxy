#!/usr/bin/env bun
import { TujiaScraper } from './scraper';

const args = process.argv.slice(2);

function parseArg(flag: string, defaultVal: string): string {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

async function main() {
  const scraper = new TujiaScraper({
    cityId: parseArg('--city', '45'),
    cityName: parseArg('--city-name', 'guangzhou'),
    checkIn: parseArg('--checkin', '2026-10-10'),
    checkOut: parseArg('--checkout', '2026-11-05'),
    guestCount: parseInt(parseArg('--guests', '1'), 10),
    headless: !hasFlag('--headed') && !process.env.HEADED,
    outputDir: parseArg('--out', './output'),
    storageState: parseArg('--state', './storage/tujia-state.json'),
  });

  console.log('═══════════════════════════════════════');
  console.log('  Tujia Scraper — Canton Fair Edition');
  console.log('═══════════════════════════════════════');
  console.log(`City:    ${scraper['options'].cityName} (ID: ${scraper['options'].cityId})`);
  console.log(`Dates:   ${scraper['options'].checkIn} → ${scraper['options'].checkOut}`);
  console.log(`Guests:  ${scraper['options'].guestCount}`);
  console.log(`Mode:    ${scraper['options'].headless ? 'headless' : 'headed (visible)'}`);
  console.log(`Session: ${scraper['options'].storageState}`);
  console.log('───────────────────────────────────────');

  const start = Date.now();
  const filepath = await scraper.run();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`
✓ Done in ${elapsed}s`);
  console.log(`  Output: ${filepath}`);
}

main().catch((err) => {
  console.error('✗ Error:', err.message);
  process.exit(1);
});

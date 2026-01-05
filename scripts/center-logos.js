// scripts/center-logos.js
// Usage: pnpm run center-logos
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const publicDir = path.join(repoRoot, "public");
const backupDir = path.join(publicDir, "backups");

if (!fs.existsSync(backupDir))
  fs.mkdirSync(backupDir, { recursive: true });

const files = fs.readdirSync(publicDir).filter(f => /^logo-symbol-\d+\.png$/.test(f));

if (files.length === 0) {
  console.log("No logo-symbol-*.png files found in public/. Nothing to do.");
  process.exit(0);
}

(async () => {
  for (const fn of files) {
    try {
      const fp = path.join(publicDir, fn);
      const raw = sharp(fp);
      const meta = await raw.metadata();
      const origW = meta.width;
      const origH = meta.height;

      // Trim transparent border
      const trimmedBuffer = await sharp(fp).trim().toBuffer();
      const tmeta = await sharp(trimmedBuffer).metadata();
      const tw = tmeta.width;
      const th = tmeta.height;

      // Compute centered offsets
      const left = Math.floor((origW - tw) / 2);
      const top = Math.floor((origH - th) / 2);

      // Backup original
      fs.copyFileSync(fp, path.join(backupDir, fn));

      // Composite trimmed onto transparent canvas of original size
      await sharp({
        create: {
          width: origW,
          height: origH,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([{ input: trimmedBuffer, left, top }])
        .png()
        .toFile(fp);

      console.log(`Processed ${fn} (${origW}x${origH}) — backup in backups/`);
    }
    catch (err) {
      console.error(`Failed processing ${fn}:`, err);
    }
  }
})();

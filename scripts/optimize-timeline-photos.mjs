import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const policy = { width: 680, quality: 80, prefix: 'timeline/optimized-v1/' };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";

export async function optimizePhoto(bytes) {
  const source = await sharp(bytes, { animated: true }).metadata();
  const output = await sharp(bytes, { animated: true }).autoOrient()
    .resize({ width: policy.width, withoutEnlargement: true })
    .webp({ quality: policy.quality }).toBuffer();
  const result = await sharp(output, { animated: true }).metadata();
  if (result.format !== 'webp' || result.width > policy.width ||
      (source.pages ?? 1) !== (result.pages ?? 1) ||
      (source.hasAlpha && !result.hasAlpha && !(await sharp(bytes, { animated: true }).stats()).isOpaque)) throw new Error('Output verification failed');
  return { output, source, result };
}

export async function switchPhoto(entry, io) {
  // Idempotent after a crash between upload, SQL commit and journal persistence.
  const bytes = await io.readCandidate(entry);
  if (hash(bytes) !== entry.afterHash) throw new Error('Candidate checksum mismatch');
  if (entry.status !== 'applied') await io.put(entry.newKey, bytes);
  if (hash(await io.get(entry.newKey)) !== entry.afterHash) throw new Error('Remote checksum mismatch');
  await io.compareAndSwap(entry);
  return await io.references(entry.newKey);
}

async function main() {
  const [mode, directory, ...flags] = process.argv.slice(2);
  if (!['prepare', 'apply', 'cleanup', 'report'].includes(mode) || !directory || !flags.includes('--remote')) {
    throw new Error('Usage: node scripts/optimize-timeline-photos.mjs prepare|apply|cleanup|report <backup-directory> --remote [--verified]');
  }
  if (mode === 'cleanup' && !flags.includes('--verified')) throw new Error('Inspect deployed photos before cleanup; then pass --verified.');
  const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  const backup = path.resolve(directory);
  // All private backups must stay within the ignored work directory.
  if (!backup.startsWith(path.join(root, 'work') + path.sep)) throw new Error('Use a backup directory inside the git-ignored work/ directory.');
  await mkdir(backup, { recursive: true, mode: 0o700 });
  const config = JSON.parse(await readFile(path.join(root, 'wrangler.jsonc'), 'utf8'));
  const bucket = config.r2_buckets.find(x => x.binding === 'MEDIA').bucket_name;
  const database = config.d1_databases.find(x => x.binding === 'DB').database_name;
  const identity = { account: config.account_id, bucket, database };
  function cli(args) {
    return execFileSync(process.execPath, [path.join(root, 'node_modules/wrangler/bin/wrangler.js'), ...args], {
      cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env, WRANGLER_LOG_PATH: path.join(root, '.wrangler/migration.log') },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
  async function sql(statement) {
    return JSON.parse(cli(['d1', 'execute', database, '--remote', '--json', '--command', statement]))
      .flatMap(x => x.results ?? []);
  }
  async function get(key, file = path.join(backup, 'verify.bin')) {
    cli(['r2', 'object', 'get', `${bucket}/${key}`, '--remote', '--file', file]);
    return readFile(file);
  }
  async function put(key, bytes) {
    const file = path.join(backup, 'upload.webp');
    await writeFile(file, bytes, { mode: 0o600 });
    cli(['r2', 'object', 'put', `${bucket}/${key}`, '--remote', '--file', file, '--content-type', 'image/webp']);
  }
  const references = key => sql(`SELECT 'timeline' AS kind, id FROM timeline_events WHERE cover_photo_key=${quote(key)} UNION ALL SELECT 'people' AS kind, id FROM family_members WHERE photo_key=${quote(key)};`);
  const manifestPath = path.join(backup, 'manifest.json');
  let manifest;
  try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (manifest && JSON.stringify(manifest.identity) !== JSON.stringify(identity)) throw new Error('Backup belongs to a different deployment');
  const save = async () => {
    await writeFile(manifestPath + '.tmp', JSON.stringify(manifest, null, 2), { mode: 0o600 });
    await rename(manifestPath + '.tmp', manifestPath);
  };
  if (mode === 'prepare') {
    if (!manifest) {
      const rows = await sql('SELECT id, cover_photo_key, cover_photo_name, cover_photo_content_type FROM timeline_events WHERE cover_photo_key IS NOT NULL;');
      manifest = { identity, policy, createdAt: new Date().toISOString(), rows, entries: [] };
      await save();
    }
    for (const key of [...new Set(manifest.rows.map(x => x.cover_photo_key))]) {
      if (manifest.entries.some(x => x.oldKey === key && x.status !== 'failed')) continue;
      manifest.entries = manifest.entries.filter(x => x.oldKey !== key);
      const entry = { oldKey: key, ids: manifest.rows.filter(x => x.cover_photo_key === key).map(x => x.id) };
      manifest.entries.push(entry);
      if (!key.startsWith('timeline/') || key.startsWith(policy.prefix)) {
        entry.status = 'skipped'; await save(); continue;
      }
      try {
        const stem = hash(key);
        entry.original = `${stem}.original`;
        const originalPath = path.join(backup, entry.original);
        let bytes;
        try { bytes = await readFile(originalPath); }
        catch (error) {
          if (error.code !== 'ENOENT') throw error;
          bytes = await get(key, originalPath + '.part');
          await rename(originalPath + '.part', originalPath);
        }
        entry.beforeHash = hash(bytes);
        entry.beforeBytes = bytes.length;
        const { output, source, result } = await optimizePhoto(bytes);
        entry.before = { width: source.width, height: source.height, format: source.format, frames: source.pages ?? 1 };
        entry.after = { width: result.width, height: result.height, format: result.format, frames: result.pages ?? 1 };
        entry.afterBytes = output.length;
        entry.afterHash = hash(output);
        entry.candidate = `${stem}.webp`;
        entry.newKey = `${policy.prefix}${entry.afterHash}.webp`;
        await writeFile(path.join(backup, entry.candidate), output, { mode: 0o600 });
        entry.status = 'prepared';
      } catch (error) { entry.status = 'failed'; entry.error = error.message; }
      await save();
    }
  } else if (!manifest) throw new Error('Run prepare first.');
  if (mode === 'apply') {
    for (const entry of manifest.entries) {
      if (!['prepared', 'applied'].includes(entry.status)) continue;
      try {
        const refs = await switchPhoto(entry, {
          readCandidate: e => readFile(path.join(backup, e.candidate)), put, get, references,
          compareAndSwap: e => {
            const names = manifest.rows.filter(row => e.ids.includes(row.id)).map(row => {
              const originalName = row.cover_photo_name || 'photo';
              return `WHEN ${row.id} THEN ${quote(originalName.replace(/\.[^.]+$/, '') + '.webp')}`;
            }).join(' ');
            return sql(`UPDATE timeline_events SET cover_photo_key=${quote(e.newKey)}, cover_photo_name=CASE id ${names} END, cover_photo_content_type='image/webp' WHERE id IN (${e.ids.join(',')}) AND cover_photo_key IN (${quote(e.oldKey)}, ${quote(e.newKey)});`);
          },
        });
        entry.status = 'applied'; entry.switchedIds = refs.filter(x => x.kind === 'timeline').map(x => x.id);
        delete entry.error;
      } catch (error) { entry.error = error.message; }
      await save();
    }
  }
  if (mode === 'cleanup') {
    for (const entry of manifest.entries) {
      if (entry.status !== 'applied') continue;
      try {
        const original = await readFile(path.join(backup, entry.original));
        if (hash(original) !== entry.beforeHash) throw new Error('Backup checksum mismatch');
        if (hash(await get(entry.newKey)) !== entry.afterHash) throw new Error('Replacement checksum mismatch');
        if (!(await references(entry.newKey)).length) {
          cli(['r2', 'object', 'delete', `${bucket}/${entry.newKey}`, '--remote']);
          entry.cleanup = 'unused-candidate-removed'; await save(); continue;
        }
        if ((await references(entry.oldKey)).length) { entry.cleanup = 'still-referenced'; await save(); continue; }
        cli(['r2', 'object', 'delete', `${bucket}/${entry.oldKey}`, '--remote']);
        entry.status = 'complete'; delete entry.error;
      } catch (error) { entry.error = error.message; }
      await save();
    }
  }
  if (manifest.entries.some(x => x.error)) process.exitCode = 1;
  const converted = manifest.entries.filter(x => x.afterBytes !== undefined);
  const before = converted.reduce((n, x) => n + x.beforeBytes, 0);
  const after = converted.reduce((n, x) => n + x.afterBytes, 0);
  console.log(JSON.stringify({ backup, images: manifest.entries.length, statuses: manifest.entries.map(x => ({ status: x.status, cleanup: x.cleanup, error: x.error })), beforeBytes: before, afterBytes: after, reductionPercent: before ? +(100 * (1 - after / before)).toFixed(2) : 0 }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import sharp from 'sharp';
import { optimizePhoto, switchPhoto, policy } from '../scripts/optimize-timeline-photos.mjs';
const dir = await mkdtemp(`${tmpdir()}/timeline-photo-test-`);
await build({ entryPoints: ['app/timeline-photo.ts'], outfile: `${dir}/photo.mjs`, bundle: true, platform: 'node', format: 'esm' });
const { optimizeTimelinePhoto, commitTimelinePhotoChange, TIMELINE_PHOTO_WIDTH, TIMELINE_PHOTO_QUALITY } = await import(pathToFileURL(`${dir}/photo.mjs`));
test.after(() => rm(dir, { recursive: true, force: true }));
const digest = b => createHash('sha256').update(b).digest('hex');

for (const [width, height, orientation] of [[2738,1826,1], [1000,2000,1], [340,200,1], [1800,1000,6]]) {
  test(`resize ${width}x${height}, orientation ${orientation}`, async () => {
    const input = await sharp({ create: { width, height, channels: 3, background: '#7294ab' } }).jpeg().withMetadata({ orientation }).toBuffer();
    const { result } = await optimizePhoto(input);
    const w = orientation === 6 ? height : width;
    const h = orientation === 6 ? width : height;
    assert.equal(result.width, Math.min(w, 680));
    assert.ok(Math.abs(result.height - h * Math.min(1, 680 / w)) <= 1);
    assert.equal(result.format, 'webp');
  });
}
test('preserves transparency and rejects corrupt input', async () => {
  const input = await sharp({ create: { width: 900, height: 300, channels: 4, background: { r: 10, g: 20, b: 30, alpha: .5 } } }).png().toBuffer();
  assert.equal((await optimizePhoto(input)).result.hasAlpha, true);
  await assert.rejects(optimizePhoto(Buffer.from('broken')));
});
test('accepts opaque PNGs whose unused alpha channel is removed', async () => {
  const input = await sharp({ create: { width: 1000, height: 800, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } } }).png().toBuffer();
  const { result } = await optimizePhoto(input);
  assert.equal(result.width, 680);
});
test('preserves animated frames and timing', async () => {
  const pixels = Buffer.alloc(20 * 40 * 4, 255);
  pixels.fill(0, 20 * 20 * 4);
  const input = await sharp(pixels, { raw: { width: 20, height: 40, channels: 4, pageHeight: 20 } }).gif({ delay: [100, 200], loop: 0 }).toBuffer();
  const { result } = await optimizePhoto(input);
  assert.equal(result.pages, 2);
  assert.deepEqual(result.delay, [100, 200]);
});
test('upload uses the same policy and never silently stores an unconverted original', async () => {
  assert.equal(TIMELINE_PHOTO_WIDTH, policy.width);
  assert.equal(TIMELINE_PHOTO_QUALITY, policy.quality);
  const file = new File(['bytes'], 'family.jpg', { type: 'image/jpeg' });
  const binding = { input() { return { transform(options) {
    assert.deepEqual(options, { width: 680, fit: 'scale-down' });
    return { async output(options) {
      assert.deepEqual(options, { format: 'image/webp', quality: 80, anim: true });
      return { response: () => new Response('webp-bytes') };
    } };
  } }; } };
  const result = await optimizeTimelinePhoto(file, binding);
  assert.match(result.key, /^timeline\/optimized-v1\/.*\.webp$/);
  assert.equal(result.name, 'family.webp');
  await assert.rejects(optimizeTimelinePhoto(file), /利用できません/);
  await assert.rejects(optimizeTimelinePhoto(file, { input() { throw new Error('decode'); } }), /変換できません/);
});
test('commit order and failure cleanup protect existing photos', async () => {
  const actions = [];
  const photo = { key: 'new', name: 'new.webp', contentType: 'image/webp' };
  await commitTimelinePhotoChange(photo, 'old', async () => actions.push('save'), async key => actions.push(`remove:${key}`));
  assert.deepEqual(actions, ['save', 'remove:old']);
  actions.length = 0;
  await assert.rejects(commitTimelinePhotoChange(photo, 'old', async () => { throw new Error('database'); }, async key => actions.push(key)), /database/);
  assert.deepEqual(actions, ['new']);
  actions.length = 0;
  await commitTimelinePhotoChange(null, 'old', async () => {}, async key => actions.push(key));
  assert.deepEqual(actions, []);
});
test('migration verifies storage before switching and safely retries', async () => {
  const bytes = Buffer.from('candidate');
  const entry = { oldKey: 'old', newKey: 'new', afterHash: digest(bytes) };
  let current = 'old'; let writes = 0;
  const io = {
    readCandidate: async () => bytes, put: async () => { writes++; }, get: async () => bytes,
    compareAndSwap: async () => { if (current === 'old') current = 'new'; },
    references: async key => current === key ? [{ id: 1 }] : [],
  };
  await assert.rejects(switchPhoto(entry, { ...io, put: async () => { throw new Error('storage'); } }), /storage/);
  assert.equal(current, 'old');
  await assert.rejects(switchPhoto(entry, { ...io, get: async () => Buffer.from('bad') }), /checksum/);
  assert.equal(current, 'old');
  assert.equal((await switchPhoto(entry, io)).length, 1);
  assert.equal((await switchPhoto(entry, io)).length, 1);
  const uploadsBeforeResume = writes;
  await switchPhoto({ ...entry, status: 'applied' }, io);
  assert.equal(writes, uploadsBeforeResume);
  current = 'concurrently-replaced';
  assert.deepEqual(await switchPhoto(entry, io), []);
  assert.equal(current, 'concurrently-replaced');
  assert.ok(writes > 0);
});

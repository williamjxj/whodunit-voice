import { test } from 'node:test';
import assert from 'node:assert/strict';
import { r2Config, isR2Enabled, signR2Request, r2GetObject, r2PutObject } from '../comfyui/cloudflareR2/r2.mjs';

const FULL = { ACCOUNT_ID: 'abc123', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', BUCKET_NAME: 'whodunit' };

test('r2Config: ACCOUNT_ID + BUCKET_NAME (user .env style)', () => {
  const cfg = r2Config(FULL);
  assert.equal(cfg.endpoint, 'https://abc123.r2.cloudflarestorage.com');
  assert.equal(cfg.bucket, 'whodunit');
});

test('r2Config: R2_ACCOUNT_ID / R2_BUCKET_NAME (rh-comfyui-app style)', () => {
  const cfg = r2Config({ R2_ACCOUNT_ID: 'abc123', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', R2_BUCKET_NAME: 'nfsw' });
  assert.equal(cfg.endpoint, 'https://abc123.r2.cloudflarestorage.com');
  assert.equal(cfg.bucket, 'nfsw');
});

test('r2Config: CLOUDFLARE_ACCOUNT_ID alias', () => {
  const cfg = r2Config({ CLOUDFLARE_ACCOUNT_ID: 'abc123', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', BUCKET_NAME: 'b' });
  assert.equal(cfg.endpoint, 'https://abc123.r2.cloudflarestorage.com');
});

test('r2Config: S3_API parsed into endpoint + bucket (LianHuanAI style)', () => {
  const cfg = r2Config({ S3_API: 'https://abc123.r2.cloudflarestorage.com/comic', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's' });
  assert.equal(cfg.endpoint, 'https://abc123.r2.cloudflarestorage.com');
  assert.equal(cfg.bucket, 'comic');
});

test('r2Config: R2_ENDPOINT overrides account derivation', () => {
  const cfg = r2Config({ ...FULL, R2_ENDPOINT: 'https://custom.example.com' });
  assert.equal(cfg.endpoint, 'https://custom.example.com');
});

test('isR2Enabled: false when flag absent or falsy', () => {
  assert.equal(isR2Enabled(FULL), false);
  assert.equal(isR2Enabled({ ...FULL, R2_IMAGES_ENABLED: '0' }), false);
  assert.equal(isR2Enabled({ ...FULL, R2_IMAGES_ENABLED: 'FALSE' }), false);
});

test('isR2Enabled: true for 1/true/yes/on (case-insensitive)', () => {
  for (const v of ['1', 'true', 'TRUE', 'yes', 'on']) {
    assert.equal(isR2Enabled({ ...FULL, R2_IMAGES_ENABLED: v }), true);
  }
});

test('isR2Enabled: false when any credential missing', () => {
  assert.equal(isR2Enabled({ R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', BUCKET_NAME: 'b', R2_IMAGES_ENABLED: '1' }), false);
  assert.equal(isR2Enabled({ ...FULL, R2_IMAGES_ENABLED: '1', R2_SECRET_ACCESS_KEY: '' }), false);
});

test('signR2Request: deterministic, correct shape, signs content-length', () => {
  const date = new Date('2026-08-15T00:00:00Z');
  const opts = {
    endpoint: 'https://abc123.r2.cloudflarestorage.com', accessKeyId: 'AK', secretAccessKey: 'SK',
    method: 'PUT', path: '/whodunit/characters/jade-pavilion/zhao_logo.png',
    body: Buffer.from('hello'), contentType: 'image/png', date,
  };
  const a = signR2Request(opts);
  assert.equal(a.authorization, signR2Request(opts).authorization); // deterministic
  assert.equal(a['x-amz-date'], '20260815T000000Z');
  assert.equal(a['x-amz-content-sha256'], '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'); // sha256('hello')
  assert.equal(a['content-length'], '5');
  assert.match(a.authorization, /^AWS4-HMAC-SHA256 Credential=AK\/20260815\/auto\/s3\/aws4_request, /);
  assert.match(a.authorization, /SignedHeaders=content-length;content-type;host;x-amz-content-sha256;x-amz-date/);
});

test('signR2Request: GET signs empty payload, no content-length', () => {
  const date = new Date('2026-08-15T00:00:00Z');
  const h = signR2Request({ endpoint: 'https://abc123.r2.cloudflarestorage.com', accessKeyId: 'AK', secretAccessKey: 'SK', method: 'GET', path: '/whodunit/characters/a.png', date });
  assert.equal(h['x-amz-content-sha256'], 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'); // sha256('')
  assert.ok(!('content-length' in h));
  assert.match(h.authorization, /SignedHeaders=host;x-amz-content-sha256;x-amz-date/);
});

test('live: r2PutObject + r2GetObject round-trip', { skip: !isR2Enabled() }, async () => {
  const buf = Buffer.from('whodunit-r2-live-check-' + Date.now());
  const key = 'test/whodunit-r2-live-check.png';
  await r2PutObject(key, buf, 'image/png');
  const back = await r2GetObject(key);
  assert.ok(back, 'r2GetObject should return the uploaded buffer');
  assert.deepEqual(back, buf);
});
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

test("keeps the Japanese password page and metadata in source", async () => {
  const [loginPage, layout] = await Promise.all([
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /title:\s*"古本家の歴史"/);
  assert.match(layout, /lang="ja"/);
  assert.match(loginPage, /家族用パスワード/);
  assert.match(loginPage, /パスワード/);
  assert.doesNotMatch(layout, /codex-preview|Starter Project/);
});

test("removes starter preview references", async () => {
  const [css, page, packageJson] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(page, /requireFamilySession/);
  assert.doesNotMatch(page, /_sites-preview|SkeletonPreview|codex-preview/);
  assert.doesNotMatch(css, /gradient|bokeh|orb/i);

  await assert.rejects(
    access(new URL("app/_sites-preview/SkeletonPreview.tsx", templateRoot)),
  );
});

test("keeps timeline location and pet category support", async () => {
  const [familyShared, schema, app] = await Promise.all([
    readFile(new URL("../app/family-shared.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/FamilyApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(familyShared, /ペット/);
  assert.match(familyShared, /location: string/);
  assert.match(schema, /text\("location"\)\.notNull\(\)\.default\(""\)/);
  assert.match(app, /TimelineEventDetailPanel/);
});

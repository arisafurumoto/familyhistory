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

test("keeps calendar time hidden and member auto-add options wired", async () => {
  const [app, familyData] = await Promise.all([
    readFile(new URL("../app/FamilyApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/family-data.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(app, /時刻（日本時間）/);
  assert.doesNotMatch(app, /終日/);
  assert.doesNotMatch(app, /name="eventTime"/);
  assert.match(app, /aria-controls="tree-add-form"/);
  assert.match(app, /addBirthTimeline/);
  assert.match(app, /addBirthCalendar/);
  assert.match(app, /addDeathTimeline/);
  assert.match(app, /addDeathCalendar/);
  assert.match(familyData, /eventTime: null/);
  assert.match(familyData, /createAutomaticFamilyEvents/);
  assert.match(familyData, /年・月・日をすべて入力してください/);
});

test("uses square crop input for member photos only", async () => {
  const app = await readFile(
    new URL("../app/FamilyApp.tsx", import.meta.url),
    "utf8",
  );

  const memberPhotoInputs = app.match(/<PhotoCropInput\b/g) ?? [];
  assert.equal(memberPhotoInputs.length, 2);
  assert.match(app, /const PHOTO_CROP_SIZE = 512/);
  assert.match(app, /appendCroppedPhoto/);
  assert.match(app, /name="coverPhoto"/);
  assert.doesNotMatch(app, /accept="image\/\*"\s+name="photo"/);
});

test("formats alphabetic member names with given name first", async () => {
  const [app, familyData, familyShared] = await Promise.all([
    readFile(new URL("../app/FamilyApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/family-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/family-shared.ts", import.meta.url), "utf8"),
  ]);

  assert.match(familyShared, /formatFamilyMemberDisplayName/);
  assert.match(familyShared, /formatFamilyMemberStoredName/);
  assert.ok(familyShared.includes("return `${givenName} ${familyName}`;"));
  assert.match(app, /formatFamilyMemberDisplayName\(person\.familyName, person\.givenName\)/);
  assert.match(familyData, /formatFamilyMemberStoredName\(familyName, givenName\)/);
});

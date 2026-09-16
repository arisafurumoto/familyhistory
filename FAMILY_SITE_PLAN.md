# Build Plan: 古本家の歴史

## Summary
Build a Japanese, password-protected family website titled `古本家の歴史` with three sections: 年表, 家系図, and カレンダー. The first page after login is 年表.

## Key Changes
- Create a new Sites web app in `/Users/arisafurumoto/Documents/FurumotoFamily`.
- Add persistent database storage for 年表 events, family tree records, relationships, and calendar events.
- Add file storage for one cover photo per 年表 event and optional person photos.
- Add shared-password login using a private deployment secret.
- Deploy through Sites and connect `furumotofamily.com` after domain purchase through Cloudflare Registrar.

## Product Features
- 年表:
  - Fields: タイトル, 日付, カテゴリー, 説明, カバー写真.
  - Dates support year-only, year/month, or full date.
  - Fixed categories/icons: 出生, 入学, 卒業, 就職, 結婚, 引越し, 旅行, 記念日, 逝去, その他.
  - Users can add/edit events; no delete UI.
- 家系図:
  - Person-centered view.
  - Fields: 名前, 写真, 生年月日, 没年月日, メモ.
  - Automatically display 星座 when 生年月日 includes month and day.
  - Automatically display 干支 when 生年月日 includes a year.
  - Use Gregorian calendar dates for both calculations.
  - Supports parents, spouses, siblings, and children.
- カレンダー:
  - Separate calendar events.
  - Supports one-time and annual recurring events.
  - Fields: タイトル, 日付, optional 時刻, optional 場所, カテゴリー, 説明, 繰り返し.

## Hosting And Domain
- Publish the site with Sites.
- Register `furumotofamily.com` through Cloudflare Registrar if available.
- Attach the custom domain in Sites and configure the required DNS records.
- Keep the site reachable by link, but require the family password before showing private content.

## Test Plan
- Confirm unauthenticated visitors only see the login page.
- Confirm logged-in visitors can create/edit 年表, 家系図, and カレンダー records.
- Verify 年表 sorting for year-only, year/month, and full dates.
- Verify image upload, display, and replacement.
- Verify 家系図 relationships render correctly.
- Verify 星座 and 干支 are calculated correctly from 生年月日.
- Verify one-time and yearly calendar events.
- Confirm all UI text is Japanese.
- Confirm no delete controls are shown.
- Run build validation before deployment.

## Assumptions
- The first version starts with empty real data for manual family entry.
- Edits are anonymous because the selected login model is a shared family password.
- The family password is not stored in source code.
- 干支 means the common Japanese twelve-animal zodiac.
- No individual accounts, approval workflow, import tool, external calendar sync, or admin dashboard in v1.

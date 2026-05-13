# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project type

WeChat mini-program (微信小程序), no bundler / no transpile step / no test runner. Editing happens directly in the source files; the WeChat DevTools (微信开发者工具) compiles and previews them. There is no `build`, `lint`, or `test` script — the only npm script is `use-miniapp` described below.

## Two coexisting shells (A-shell vs B-shell)

The single binary hosts **two independent product features** that the launcher routes between at runtime. Treat them as separate apps that happen to share infrastructure.

- **A-shell — 账本 (bookkeeping)**: local-only personal ledger. Default mode. Code lives at the **top level**: `pages/home`, `pages/add`, `pages/mine`, `pages/bill-detail`, `pages/bill-manage`, `pages/stats`, `pages/about`. Data is persisted to `wx.setStorageSync` under key `mini-book-tide-data-v1` via `utils/bill.js`. The three tabbar entries in `app.json` (账本 / 记账 / 我的) are all A-shell.
- **B-shell — 短剧 (short drama)**: networked content app. All B-shell code is namespaced under a `book-detail/` subdirectory in every layer: `pages/book-detail/*`, `utils/book-detail/*`, `services/book-detail/*`, `stores/book-detail/*`, `runtime/book-detail/*`, `components/book-detail/*`, `config/book-detail/*`, `assets/book-detail/*`. Bootstrap logic lives in `runtime/book-detail/app-runtime.js` (login, store init, H5 feed sync).

When changing one shell, do not modify the other. Shared global styles in `app.wxss` are used by both — don't delete classes that look unused in A-shell without checking B-shell pages first.

## Launcher routing

`pages/launcher/index` is the `entryPagePath`. On load it:

1. Calls `{currentProfile.baseUrl}/miniapp/bootstrap?app={appIdentifier}` via `app.js → fetchMiniAppShellConfigWithRetry()` to get `{ mode: 'A' | 'B', tab_bar: {...} }`.
2. Does not cache `mode`; every cold launch and hot launch goes back through launcher and requests bootstrap again.
3. `mode === 'B'` → fetches `/miniapp/layout` while validating the local B-shell passcode via `/miniapp/passcode/verify`. Missing, expired, invalid, or network-failed passcodes keep the user on `/pages/home/index` and show the passcode dialog. A valid passcode opens B-shell theater, or the returned album on the first successful validation for that passcode period.
4. `mode === 'A'` → `wx.switchTab` to `/pages/home/index` and clears pending passcode prompts.

`utils/shell-pages.js` is the source of truth for B-shell page paths — use `buildBShellPageUrl(pageKey, query)` rather than hard-coding paths.

## Multi-mini-app profile system

The repo is a template designed to be re-skinned for different WeChat appIds.

- `config/miniapp-profiles.js` — registry of profiles (currently only `dongdongzhushou`). Each profile contains `appId`, `appName`, `appIdentifier` (used as the `app=` param to the bootstrap API), `baseUrl`, `h5PlayerUrl`, `enableMockData`.
- `config/current-miniapp.js` — generated file pinning `CURRENT_MINIAPP_KEY`. **Do not hand-edit**; it is rewritten by the script below.
- `scripts/use-miniapp.js <key>` (run via `npm run use-miniapp <key>`) — switches the active profile by rewriting `project.config.json` (appid, projectname), `project.private.config.json`, `app.json` (`window.navigationBarTitleText`), `sitemap.json`, and `config/current-miniapp.js`. Run with no args or `--list` to see available keys.

`utils/runtime-miniapp.js → getCurrentMiniAppProfile()` resolves the profile at runtime by matching `wx.getAccountInfoSync().miniProgram.appId` against the registry, falling back to `currentProfile`. Use this rather than importing `currentProfile` directly when you need the live profile.

`currentProfile.enableMockData` is read by `utils/bill.js → getDefaultData()`: when `false`, demo bills (ids prefixed `demo_`) are filtered out of storage on every `ensureBookData()` call. This is why toggling the flag automatically cleans/seeds data on next launch.

## A-shell data layer

All bookkeeping operations go through `utils/bill.js`:

- `ensureBookData()` — idempotent storage bootstrap; called from `app.js → onLaunch` and from each A-shell page's `onShow`.
- `addBill / removeBillById / getAllBills / getBillById` — CRUD; bills are auto-sorted by date desc (then `createdAt` desc).
- `getSummary(bills)`, `getBillsByMonth(monthKey)`, `groupByCategory(bills, type)`, `getRecentMonths(count)` — aggregation helpers used by home/stats.
- `createDisplayBill(item)` — formats a raw bill for view layer (adds `typeText`, `dateText`, `note` fallback "未填写备注", amount as fixed-2 string).

Storage key: `mini-book-tide-data-v1`. Schema: `{ version, initializedAt, bills: [...], updatedAt }`.

## Page boilerplate

`utils/page.js → createPage(options)` wraps `Page()` to call `wx.hideShareMenu` on every `onLoad` and `onShow`. The launcher uses it. A-shell pages currently use raw `Page({...})` — keep them consistent unless you have a reason to change. B-shell page bootstrap goes through `runtime/book-detail/app-runtime.js → ensureStarted(options)` which must be awaited before reading B-shell stores.

## Conventions worth knowing

- A-shell uses CommonJS (`require` / `module.exports`) and a function-based style; B-shell mirrors that. No ES modules, no TypeScript.
- Global design tokens (CSS variables `--brand`, `--income`, `--expense`, etc.) and `.page-shell` / `.page-hero` / `.card` / `.chip-row` / `.chip` / `.rise-card` shared classes live in `app.wxss`. Reuse them rather than redefining colors/spacing per page.
- `wx.request` is called directly in `app.js` for shell config; B-shell uses its own `services/book-detail/request.js` wrapper. There is no shared HTTP client across the two shells.

# touchgrass — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**touchgrass** is a typescript project built with raw-http.

## Scale

35 UI components · 59 library files · 1 middleware layers · 3 environment variables

**UI:** 35 components (react) — see [ui.md](./ui.md)

**Libraries:** 59 files — see [libraries.md](./libraries.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `src/storage/index.ts` — imported by **68** files
- `src/i18n/index.ts` — imported by **53** files
- `src/store/useAppStore.ts` — imported by **35** files
- `src/utils/theme.ts` — imported by **31** files
- `src/detection/index.ts` — imported by **14** files
- `src/storage/db.ts` — imported by **11** files

## Required Environment Variables

- `EAS_BUILD_PROFILE` — `app.config.js`
- `EXPO_PUBLIC_SHOW_DEV_MENU` — `src/screens/SettingsScreen.tsx`
- `NODE_ENV` — `metro.config.js`

---

_Back to [index.md](./index.md) · Generated 2026-04-28_

# touchgrass — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**touchgrass** is a typescript project built with raw-http.

## Scale

39 UI components · 58 library files · 1 middleware layers · 3 environment variables

**UI:** 39 components (react) — see [ui.md](./ui.md)

**Libraries:** 58 files — see [libraries.md](./libraries.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `src\utils\theme.ts` — imported by **37** files
- `src\store\useAppStore.ts` — imported by **33** files
- `src\notifications\notificationManager.ts` — imported by **13** files
- `src\storage\StorageService.ts` — imported by **11** files
- `src\components\ResponsiveGridList.tsx` — imported by **11** files
- `src\utils\helpers.ts` — imported by **10** files

## Required Environment Variables

- `EAS_BUILD_PROFILE` — `app.config.js`
- `EXPO_PUBLIC_SHOW_DEV_MENU` — `src\screens\SettingsScreen.tsx`
- `NODE_ENV` — `metro.config.js`

---

_Back to [index.md](./index.md) · Generated 2026-05-03_

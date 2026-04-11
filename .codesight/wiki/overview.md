# touchgrass — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**touchgrass** is a typescript project built with raw-http.

## Scale

37 UI components · 1 middleware layers · 2 environment variables

**UI:** 37 components (react) — see [ui.md](./ui.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `src/storage/database.ts` — imported by **68** files
- `src/i18n/index.ts` — imported by **42** files
- `src/context/ThemeContext.tsx` — imported by **29** files
- `src/utils/theme.ts` — imported by **26** files
- `src/utils/helpers.ts` — imported by **10** files
- `src/detection/index.ts` — imported by **9** files

## Required Environment Variables

- `EAS_BUILD_PROFILE` — `app.config.js`
- `NODE_ENV` — `metro.config.js`

---

_Back to [index.md](./index.md) · Generated 2026-04-10_

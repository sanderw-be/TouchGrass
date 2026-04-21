## [1.7.2](https://github.com/sanderw-be/TouchGrass/compare/v1.7.1...v1.7.2) (2026-04-21)

### Bug Fixes

- Minimize HC permissions, improve all permission flows, clarify Health Connect detects outdoor time via steps AND exercise sessions ([#409](https://github.com/sanderw-be/TouchGrass/issues/409)) ([a020d9b](https://github.com/sanderw-be/TouchGrass/commit/a020d9b978191cdb82144aaa9e8e44b03abf78c3))
- update Health Connect rationale and permissions handling in multiple languages and start major refactor ([c3f24a2](https://github.com/sanderw-be/TouchGrass/commit/c3f24a23aa90bb2e2c2ca8a095828da39acbc64b))

## [1.7.2-beta.2](https://github.com/sanderw-be/TouchGrass/compare/v1.7.2-beta.1...v1.7.2-beta.2) (2026-04-17)

### Bug Fixes

- update Health Connect rationale and permissions handling in multiple languages and start major refactor ([3c96ff8](https://github.com/sanderw-be/TouchGrass/commit/3c96ff8ce0a2e8e8de84648099bfcb38e88da30f))

## [1.7.2-beta.1](https://github.com/sanderw-be/TouchGrass/compare/v1.7.1...v1.7.2-beta.1) (2026-04-14)

### Bug Fixes

- Minimize HC permissions, improve all permission flows, clarify Health Connect detects outdoor time via steps AND exercise sessions ([#409](https://github.com/sanderw-be/TouchGrass/issues/409)) ([9686d8e](https://github.com/sanderw-be/TouchGrass/commit/9686d8e73909a0e69b77f1b007f310a2adf8602e))

## [1.7.1](https://github.com/sanderw-be/TouchGrass/compare/v1.7.0...v1.7.1) (2026-04-13)

### Bug Fixes

- **ui:** Apply dynamic dark-theme background to React Navigation base layers to prevent transition flash ([#403](https://github.com/sanderw-be/TouchGrass/issues/403)) ([ffcc4fd](https://github.com/sanderw-be/TouchGrass/commit/ffcc4fd7786848664113c40e6ac359b836dcd647))

## [1.7.1-beta.1](https://github.com/sanderw-be/TouchGrass/compare/v1.7.0...v1.7.1-beta.1) (2026-04-13)

### Bug Fixes

- **ci:** Implement beta branch workflows for auto-deployment ([#405](https://github.com/sanderw-be/TouchGrass/issues/405)) ([923c9da](https://github.com/sanderw-be/TouchGrass/commit/923c9da730d9c226063d5a45d998cec83ebaf64a))
- **ui:** Apply dynamic dark-theme background to React Navigation base layers to prevent transition flash ([#403](https://github.com/sanderw-be/TouchGrass/issues/403)) ([ffcc4fd](https://github.com/sanderw-be/TouchGrass/commit/ffcc4fd7786848664113c40e6ac359b836dcd647))

# [1.7.0](https://github.com/sanderw-be/TouchGrass/compare/v1.6.4...v1.7.0) (2026-04-12)

### Bug Fixes

- configure Gradle for CI to prevent build hangs and OOM kills ([#394](https://github.com/sanderw-be/TouchGrass/issues/394)) [skip ci] ([6f7631e](https://github.com/sanderw-be/TouchGrass/commit/6f7631e5119fc5e3a6f687ad95b8115e7d99cfa5))

### Features

- Add notes to sessions ([#396](https://github.com/sanderw-be/TouchGrass/issues/396)) ([1b54c39](https://github.com/sanderw-be/TouchGrass/commit/1b54c39fc34351c16d6a4fae660b59d76a5c40a6))
- **ci:** Preview builds AAB ([ffd7619](https://github.com/sanderw-be/TouchGrass/commit/ffd7619dc8a86a6b1942bb75de9b95660ddc7690))
- Expand i18n to 7 locales, align outdoor-focused copy tone, and add collapsible language picker ([#398](https://github.com/sanderw-be/TouchGrass/issues/398)) ([504fde3](https://github.com/sanderw-be/TouchGrass/commit/504fde3c152b564d1154a471c99fff27922efed7))
- **ui:** Use community components for bottom sheets and keyboard avoiding views ([#401](https://github.com/sanderw-be/TouchGrass/issues/401)) [skip ci] ([15ebe52](https://github.com/sanderw-be/TouchGrass/commit/15ebe525c26ded0c53229890215d915a66ade0a0))

## [1.6.4](https://github.com/sanderw-be/TouchGrass/compare/v1.6.3...v1.6.4) (2026-04-11)

### Bug Fixes

- set EAS_BUILD_PROFILE env var for local builds to fix fingerprint mismatch ([#391](https://github.com/sanderw-be/TouchGrass/issues/391)) ([1aff16e](https://github.com/sanderw-be/TouchGrass/commit/1aff16e7dc3554d7c1764972837077699bb3911b))
- Update app.json ([c73b811](https://github.com/sanderw-be/TouchGrass/commit/c73b8118d7a689fbb334c0f0559889623b69dd44))

## [1.6.3](https://github.com/sanderw-be/TouchGrass/compare/v1.6.2...v1.6.3) (2026-04-11)

### Bug Fixes

- remove wrong node versions ([9ca49b3](https://github.com/sanderw-be/TouchGrass/commit/9ca49b3cfef1b3be7c8531e48195cc46057cece3))

## [1.6.2](https://github.com/sanderw-be/TouchGrass/compare/v1.6.1...v1.6.2) (2026-04-11)

### Bug Fixes

- package-lock in semver ([b737fb6](https://github.com/sanderw-be/TouchGrass/commit/b737fb6936dbe37a82c90db681cb04a888b6011d))

## [1.6.1](https://github.com/sanderw-be/TouchGrass/compare/v1.6.0...v1.6.1) (2026-04-11)

### Bug Fixes

- EAS use node version 20.x ([e1d1de2](https://github.com/sanderw-be/TouchGrass/commit/e1d1de238b27a968a164a438bcb40ee8e8197d77))

# [1.6.0](https://github.com/sanderw-be/TouchGrass/compare/v1.5.1...v1.6.0) (2026-04-11)

### Features

- **cicd:** Perms: improve flow CI/CD: git-diff native detection, always-on OTA update, local builds with artifact upload, pre-releases on preview, promote to full release on production ([#390](https://github.com/sanderw-be/TouchGrass/issues/390)) ([2fccc3d](https://github.com/sanderw-be/TouchGrass/commit/2fccc3d3007163bf64188782f0e4ce469f1e8754))

# [1.6.0](https://github.com/sanderw-be/TouchGrass/compare/v1.5.1...v1.6.0) (2026-04-10)

### Features

- **cicd:** semver in dev builds, pre-releases in preview, promote on production ([c078684](https://github.com/sanderw-be/TouchGrass/commit/c07868449387838f10a64aee098fbfde08870c80))

## [1.5.1](https://github.com/sanderw-be/TouchGrass/compare/v1.5.0...v1.5.1) (2026-04-08)

### Bug Fixes

- EAS update splash screen + manual update trigger in diagnostics ([#385](https://github.com/sanderw-be/TouchGrass/issues/385)) ([1b101c8](https://github.com/sanderw-be/TouchGrass/commit/1b101c8a1e7d6984b1553f1544ecf85d29bd21b2))
- onboarding permission defaults, post-tutorial feature flags, permission warning banners, widget tip spacing ([#382](https://github.com/sanderw-be/TouchGrass/issues/382)) ([8c5947c](https://github.com/sanderw-be/TouchGrass/commit/8c5947cf6f462bc3094371fbf24cade35880f76a))

# [1.5.0](https://github.com/sanderw-be/TouchGrass/compare/v1.4.0...v1.5.0) (2026-04-07)

### Bug Fixes

- add comprehensive error handling to prevent cursor close errors and remove loops for streak calculations ([dc97e50](https://github.com/sanderw-be/TouchGrass/commit/dc97e50bdc9ea766c3f61e6a33aecfcd127e842b)), closes [#359](https://github.com/sanderw-be/TouchGrass/issues/359)
- Android widget goes blank after app update ([#372](https://github.com/sanderw-be/TouchGrass/issues/372)) ([bc31351](https://github.com/sanderw-be/TouchGrass/commit/bc31351555061fd65c9f61ef43b9d35841628c47))
- database migration storm using PRAGMA user_version ([#362](https://github.com/sanderw-be/TouchGrass/issues/362)) ([50fc0d5](https://github.com/sanderw-be/TouchGrass/commit/50fc0d5e981a4c7859d7f5d91d00911461da7d12))
- Prevent trigger storms with isFetchingRef lock across all data-fetching screens ([#366](https://github.com/sanderw-be/TouchGrass/issues/366)) ([7fb838f](https://github.com/sanderw-be/TouchGrass/commit/7fb838f5d5766a97112137cda67bd5c5c257546f))
- trigger widget refresh on confirmed session retraction ([#357](https://github.com/sanderw-be/TouchGrass/issues/357)) ([36939ec](https://github.com/sanderw-be/TouchGrass/commit/36939ecc8030fe45ddcc460cff96e9c4f2d217f1))
- widget crash at app update: patch HeadlessJsTaskWorker to handle warm-start after app update ([#375](https://github.com/sanderw-be/TouchGrass/issues/375)) ([d05fe91](https://github.com/sanderw-be/TouchGrass/commit/d05fe91b454935ecfaea00edbd74020400032f3f))

### Features

- **db:** Migrate background tasks to async SQLite API ([#373](https://github.com/sanderw-be/TouchGrass/issues/373)) ([978b7f3](https://github.com/sanderw-be/TouchGrass/commit/978b7f3e2b2cc185b0ca951f9160107dce9e8cdf))
- **dev:** Implement EAS Update and CI Maestro Screenshot workflow ([#379](https://github.com/sanderw-be/TouchGrass/issues/379)) ([ad02183](https://github.com/sanderw-be/TouchGrass/commit/ad021837ecfdd630372694c182356fc806a847e4))
- Diagnostic Build Info Bottom Sheet in Settings ([#380](https://github.com/sanderw-be/TouchGrass/issues/380)) ([29f8f78](https://github.com/sanderw-be/TouchGrass/commit/29f8f788d17857ad8744181d759687d673815162))
- UI database calls to async API, preserve sync for widget ([#365](https://github.com/sanderw-be/TouchGrass/issues/365)) ([c69f231](https://github.com/sanderw-be/TouchGrass/commit/c69f2318e2ad6d03402beea4d5612fb6304a20e0))

# [1.4.0](https://github.com/sanderw-be/TouchGrass/compare/v1.3.1...v1.4.0) (2026-04-05)

### Bug Fixes

- Android "considered buggy" JobScheduler warning + dynamic location accuracy with burst strategy ([#353](https://github.com/sanderw-be/TouchGrass/issues/353)) ([f402690](https://github.com/sanderw-be/TouchGrass/commit/f402690fd53cc3e538e7bd94d0ed380c36714c0b))
- widget size regression, stop button color, session confirmation refresh, bidirectional timer sync, and seedling brand mark ([#355](https://github.com/sanderw-be/TouchGrass/issues/355)) ([bdc6e12](https://github.com/sanderw-be/TouchGrass/commit/bdc6e12e6c43d3cd1737bdd3aec652e7dc8615bb))

### Features

- implement progress ring widget ([#351](https://github.com/sanderw-be/TouchGrass/issues/351)) ([33694c6](https://github.com/sanderw-be/TouchGrass/commit/33694c610c36a2f1ab930b132c1024c0314f5459))

## [1.3.1](https://github.com/sanderw-be/TouchGrass/compare/v1.3.0...v1.3.1) (2026-04-04)

### Bug Fixes

- prevent double-scheduling and race conditions on concurrent Tick+PulseTick ([#341](https://github.com/sanderw-be/TouchGrass/issues/341)) ([c0d673b](https://github.com/sanderw-be/TouchGrass/commit/c0d673bd40685f07ce64dd3cb1c0721d32c8025e))
- resolve Prettier formatting failures in app.json and CHANGELOG.md ([#339](https://github.com/sanderw-be/TouchGrass/issues/339)) ([fea8f8b](https://github.com/sanderw-be/TouchGrass/commit/fea8f8b29ea4d2a5b81ac6e058e34e6ae7de4f28))

# [1.3.0](https://github.com/sanderw-be/TouchGrass/compare/v1.2.0...v1.3.0) (2026-04-04)

### Bug Fixes

- Add timer explanation hint on HomeScreen ([#329](https://github.com/sanderw-be/TouchGrass/issues/329)) ([e0989ba](https://github.com/sanderw-be/TouchGrass/commit/e0989ba5809133f5d27382be2c4775abb5080559))
- **background:** back up WorkManager periodic task with Pulsar chained-alarm architecture ([#331](https://github.com/sanderw-be/TouchGrass/issues/331)) ([6a0223f](https://github.com/sanderw-be/TouchGrass/commit/6a0223f1e5866d05158a5f3af63414ce068ba4d5))
- emit sessionsChanged in HomeScreen.handleConfirm so badge updates immediately ([939f512](https://github.com/sanderw-be/TouchGrass/commit/939f512428746952b9fafe203bfc739f4f8acb98))
- missing activity log entries for tick_planned smart reminders ([#333](https://github.com/sanderw-be/TouchGrass/issues/333)) ([fbab9dd](https://github.com/sanderw-be/TouchGrass/commit/fbab9dd57802ac5e072268ad6d19fcb97fb53bf6))
- use grassDark for snackbar background to ensure readable text in dark mode ([739549f](https://github.com/sanderw-be/TouchGrass/commit/739549f48c37e3058da9597da2f98c6fa8a92944))

### Features

- Add empty-state illustration and tagline to HomeScreen ([#328](https://github.com/sanderw-be/TouchGrass/issues/328)) ([38c9650](https://github.com/sanderw-be/TouchGrass/commit/38c965073f177fe7a14404c967825368ea51d7d9))
- add Google Forms disclosure with privacy policy link on FeedbackSupportScreen ([c9cbaf6](https://github.com/sanderw-be/TouchGrass/commit/c9cbaf6031e235f9985c67ebd314a32c29258fa9))
- add undo snackbar after swipe-to-reject session action ([a21eada](https://github.com/sanderw-be/TouchGrass/commit/a21eada7ebede782ec700ffb22a5b61591645fb5))
- Settings → About → TouchGrass navigates to app documentation screen ([#336](https://github.com/sanderw-be/TouchGrass/issues/336)) ([ba1c9f9](https://github.com/sanderw-be/TouchGrass/commit/ba1c9f977ef83a07f34119ab2a8aadbdf40e7d64))
- show app version in settings about section ([4fe5fea](https://github.com/sanderw-be/TouchGrass/commit/4fe5fea786864d2b09c17304d6df55e688cc8134))
- smart reminders notification permission check and UI indicator ([4f99f77](https://github.com/sanderw-be/TouchGrass/commit/4f99f770d42488d20664c108b3918558e26a25c0))
- split GoalsScreen into RemindersSection, WeatherSection, CalendarSection sub-components ([0f2aa36](https://github.com/sanderw-be/TouchGrass/commit/0f2aa360d34777cba1803cff650ffdc8fda44354))

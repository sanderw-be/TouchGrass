## [1.3.1](https://github.com/sanderw-be/TouchGrass/compare/v1.3.0...v1.3.1) (2026-04-04)


### Bug Fixes

* prevent double-scheduling and race conditions on concurrent Tick+PulseTick ([#341](https://github.com/sanderw-be/TouchGrass/issues/341)) ([c0d673b](https://github.com/sanderw-be/TouchGrass/commit/c0d673bd40685f07ce64dd3cb1c0721d32c8025e))
* resolve Prettier formatting failures in app.json and CHANGELOG.md ([#339](https://github.com/sanderw-be/TouchGrass/issues/339)) ([fea8f8b](https://github.com/sanderw-be/TouchGrass/commit/fea8f8b29ea4d2a5b81ac6e058e34e6ae7de4f28))

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

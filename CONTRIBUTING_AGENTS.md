# Contributing — AI Agent Commit Rules

This file defines the **mandatory commit-message and PR conventions** that all AI agents (GitHub Copilot, Cursor, etc.) and human contributors must follow when working in this repository.

---

## 1. Conventional Commits

Every commit message **must** follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Allowed types

| Type       | When to use                                                     | Release bump |
| ---------- | --------------------------------------------------------------- | ------------ |
| `feat`     | A new feature visible to the end user                           | **minor**    |
| `fix`      | A bug fix visible to the end user                               | **patch**    |
| `chore`    | Build system, tooling, dependency updates, CI changes           | none         |
| `docs`     | Documentation only                                              | none         |
| `refactor` | Code restructuring with no behaviour change                     | none         |
| `test`     | Adding or updating tests only                                   | none         |
| `style`    | Formatting, whitespace, missing semicolons — no logic change    | none         |
| `perf`     | Performance improvement                                         | **patch**    |
| `revert`   | Reverts a previous commit                                       | patch/minor  |

> **Breaking changes**: append `!` after the type/scope (`feat!:` or `feat(api)!:`) **and** add a `BREAKING CHANGE:` footer. This triggers a **major** version bump.

### Rules

- The description must be **imperative, lower-case, ≤ 72 characters**, no trailing period.
- Do **not** use vague messages like `fix: stuff` or `chore: update`.
- Each commit should represent **one logical change**.

### Examples

```
feat(ui): add outdoor session progress ring to home screen
fix(gps): prevent duplicate session insertion on reconnect
chore(deps): bump expo-sqlite to 15.1.2
docs(readme): update Health Connect setup instructions
refactor(storage): extract database migration helper
feat(notifications)!: replace legacy push tokens with Expo Notifications v2

BREAKING CHANGE: The `legacyToken` field is removed from the notification payload.
```

---

## 2. Scopes

Use a scope whenever the change is clearly contained in one area. This makes changelogs and release notes much more readable.

### Recommended scopes

| Scope           | Area of the codebase                                  |
| --------------- | ----------------------------------------------------- |
| `ui`            | Visual components, screens, theme, layout             |
| `gps`           | GPS detection and session tracking                    |
| `health`        | Health Connect / HealthKit integration                |
| `notifications` | Reminder scheduling and notification logic            |
| `storage`       | SQLite database, migrations, queries                  |
| `background`    | Background tasks, alarm bridge, Pulsar                |
| `widget`        | Android home-screen widget                            |
| `weather`       | Weather integration and settings                      |
| `i18n`          | Translations (EN, NL), locale files                   |
| `api`           | External API calls (weather service, etc.)            |
| `ci`            | GitHub Actions workflows, EAS build config            |
| `deps`          | Dependency updates (`chore(deps):`)                   |
| `release`       | Release tooling, semantic-release config              |

Omit the scope only when the change truly crosses multiple areas with no single dominant one.

---

## 3. Squash & Merge — PR Title Is the Release Note

This repository uses a **"Squash and Merge"** strategy. When a PR is squashed:

- The **PR title becomes the single commit message** that semantic-release reads.
- The PR title **is** the entry that appears in `CHANGELOG.md` and on the GitHub Release page.
- Every individual commit inside the PR branch is collapsed; their messages are irrelevant to the release.

### Consequences for AI agents

1. **Always set the PR title** using Conventional Commits format — it is the most important piece of data.
2. The PR title must accurately describe the user-visible impact of the entire PR.
3. Do **not** put implementation details (file names, internal function names) in the PR title.
4. Keep the PR title under **72 characters**.
5. Use the body of the PR description for technical detail, not the title.

### Good PR titles

```
feat(ui): show weekly outdoor minutes on home screen
fix(gps): ignore sessions shorter than 5 minutes
chore(ci): switch release trigger to workflow_dispatch
docs: add CONTRIBUTING_AGENTS guidelines
```

### Bad PR titles

```
Update stuff                          # not conventional, not descriptive
fix: fixed the bug in database.ts     # vague, leaks implementation detail
feat: new feature for users           # too vague to generate a useful release note
WIP: working on notifications         # work-in-progress title should never be merged
```

---

## 4. Play Store Release Notes

After every release, semantic-release automatically generates Play Store–ready release notes stored in:

```
docs/play-store-release-notes/
  v<version>-en.txt   # English  (≤ 500 characters)
  v<version>-nl.txt   # Dutch    (≤ 500 characters)
```

These files are committed to `main` as part of the release commit. They are derived from the `CHANGELOG.md` entries that semantic-release generates, which in turn come from the **PR titles** (see §3). Well-written PR titles therefore directly produce high-quality release notes.

---

## 5. Quick Reference Checklist for AI Agents

Before opening or updating a PR, verify:

- [ ] PR title follows `<type>(<scope>): <description>` format
- [ ] Type is one of: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `revert`
- [ ] Description is imperative, lower-case, ≤ 72 characters, no trailing period
- [ ] Scope is included when the change is contained in one area
- [ ] Breaking changes include `!` suffix and `BREAKING CHANGE:` footer
- [ ] No sensitive data, secrets, or credentials in commit messages
- [ ] Individual commits inside the branch also follow Conventional Commits (good practice, even if squashed)

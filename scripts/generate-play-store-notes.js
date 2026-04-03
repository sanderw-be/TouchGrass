#!/usr/bin/env node
/**
 * Generates Play Store release notes from CHANGELOG.md.
 *
 * Usage: node scripts/generate-play-store-notes.js <version>
 *
 * Output:
 *   docs/play-store-release-notes/v<version>-en.txt  (max 500 chars)
 *   docs/play-store-release-notes/v<version>-nl.txt  (max 500 chars)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const version = process.argv[2];

if (!version) {
  console.error('Usage: generate-play-store-notes.js <version>');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`Invalid version format: "${version}". Expected semver (e.g. 1.2.3)`);
  process.exit(1);
}

const MAX_CHARS = 500;

const changelogPath = path.resolve(__dirname, '..', 'CHANGELOG.md');

if (!fs.existsSync(changelogPath)) {
  console.error('CHANGELOG.md not found. Skipping Play Store notes generation.');
  process.exit(0);
}

const changelog = fs.readFileSync(changelogPath, 'utf8');

/**
 * Escape all special regex characters in a string so it can be safely
 * embedded inside a RegExp constructor without unintended behaviour.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract the section for the given version from CHANGELOG.md.
 * semantic-release writes headings like: ## [1.2.3] (...)
 */
function extractVersionSection(content, ver) {
  // Match heading for this version (e.g. ## [1.2.3] or ## 1.2.3)
  const escapedVer = escapeRegex(ver);
  const startRe = new RegExp(`^##\\s+\\[?${escapedVer}\\]?`, 'm');
  const startMatch = startRe.exec(content);
  if (!startMatch) return '';

  const start = startMatch.index + startMatch[0].length;

  // Find the next ## heading to delimit this section
  const nextHeadingRe = /^##\s+/m;
  const remainder = content.slice(start);
  const nextMatch = nextHeadingRe.exec(remainder);
  const sectionText = nextMatch ? remainder.slice(0, nextMatch.index) : remainder;
  return sectionText;
}

/**
 * Parse a CHANGELOG section into lists of features and fixes.
 * Handles sub-sections like ### Features, ### Bug Fixes.
 */
function parseSection(section) {
  const features = [];
  const fixes = [];
  let current = null;

  for (const line of section.split('\n')) {
    const trimmed = line.trim();

    if (/^#{2,4}\s*(features|new features)/i.test(trimmed)) {
      current = 'features';
    } else if (/^#{2,4}\s*(bug fixes|fixes)/i.test(trimmed)) {
      current = 'fixes';
    } else if (/^#{2,4}/.test(trimmed)) {
      current = null;
    } else if (trimmed.startsWith('*') && current) {
      // Strip leading "* " and trailing PR/commit links like ([abc1234](url))
      let msg = trimmed.replace(/^\*+\s*/, '');
      msg = msg.replace(/\(\[[\w-]+\]\([^)]+\)\)/g, '').trim();
      msg = msg.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
      // Strip bold scope prefix like "**scope:**"
      msg = msg.replace(/\*\*[^*]+:\*\*\s*/g, '').trim();
      // Remove trailing comma/period clutter
      msg = msg.replace(/[,;]+$/, '').trim();
      // Capitalize
      if (msg.length > 2) {
        msg = msg.charAt(0).toUpperCase() + msg.slice(1);
        if (current === 'features') features.push(msg);
        else fixes.push(msg);
      }
    }
  }

  return { features, fixes };
}

/**
 * Build English Play Store release notes.
 */
function buildEn(ver, features, fixes) {
  const lines = [`TouchGrass ${ver}`, ''];

  if (features.length > 0) {
    lines.push("✨ What's new:");
    for (const f of features) lines.push(`• ${f}`);
    lines.push('');
  }

  if (fixes.length > 0) {
    lines.push('🐛 Bug fixes:');
    for (const f of fixes) lines.push(`• ${f}`);
  }

  if (features.length === 0 && fixes.length === 0) {
    lines.push('Performance improvements and bug fixes.');
  }

  return lines.join('\n').trim();
}

/**
 * Build Dutch Play Store release notes.
 * Section headers are translated; individual entries remain in English
 * since they are derived from developer commit messages.
 */
function buildNl(ver, features, fixes) {
  const lines = [`TouchGrass ${ver}`, ''];

  if (features.length > 0) {
    lines.push('✨ Nieuw:');
    for (const f of features) lines.push(`• ${f}`);
    lines.push('');
  }

  if (fixes.length > 0) {
    lines.push('🐛 Verbeteringen:');
    for (const f of fixes) lines.push(`• ${f}`);
  }

  if (features.length === 0 && fixes.length === 0) {
    lines.push('Prestatieverbeteringen en bugfixes.');
  }

  return lines.join('\n').trim();
}

/**
 * Truncate text to maxLen characters, breaking at a line boundary where possible.
 */
function truncate(text, maxLen) {
  if (text.length <= maxLen) return text;
  const candidate = text.slice(0, maxLen);
  const lastNl = candidate.lastIndexOf('\n');
  // Only break at newline when it falls in the latter half of the allowed
  // length (> 40 %), so we keep a meaningful amount of text while still
  // ending at a clean line boundary.
  if (lastNl > maxLen * 0.4) {
    return candidate.slice(0, lastNl).trimEnd() + '…';
  }
  return candidate.trimEnd() + '…';
}

// --- Main ---

const section = extractVersionSection(changelog, version);
const { features, fixes } = parseSection(section);

const enRaw = buildEn(version, features, fixes);
const nlRaw = buildNl(version, features, fixes);

const enNotes = truncate(enRaw, MAX_CHARS);
const nlNotes = truncate(nlRaw, MAX_CHARS);

const outputDir = path.resolve(__dirname, '..', 'docs', 'play-store-release-notes');
fs.mkdirSync(outputDir, { recursive: true });

const enPath = path.join(outputDir, `v${version}-en.txt`);
const nlPath = path.join(outputDir, `v${version}-nl.txt`);

fs.writeFileSync(enPath, enNotes, 'utf8');
fs.writeFileSync(nlPath, nlNotes, 'utf8');

console.log(`Generated Play Store release notes for v${version}`);
console.log(`EN (${enNotes.length} chars):\n${enNotes}\n`);
console.log(`NL (${nlNotes.length} chars):\n${nlNotes}\n`);

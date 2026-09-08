#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Cross-platform LibreOffice setup checker.
 *
 * Detects whether LibreOffice is installed and prints
 * platform-specific install instructions if missing.
 *
 * Usage:
 *   node scripts/setup-libreoffice.js
 *   pnpm setup:lo
 *
 * Exit codes:
 *   0 — LO found (or env override set)
 *   1 — LO not found
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PLATFORM = process.platform;
const ENV_OVERRIDE = process.env.LO_SOFFICE_PATH;

const CANDIDATES = {
  win32: [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  ],
  darwin: ['/Applications/LibreOffice.app/Contents/MacOS/soffice'],
  linux: [
    '/usr/lib/libreoffice/program/soffice',
    '/usr/bin/soffice',
    '/usr/local/bin/soffice',
    '/usr/lib64/libreoffice/program/soffice',
  ],
};

const INSTALL_COMMANDS = {
  win32: '  winget install TheDocumentFoundation.LibreOffice',
  darwin: '  brew install --cask libreoffice',
  linux: '  sudo apt-get update && sudo apt-get install -y libreoffice',
};

const WINDOWS_UNINSTALL_KEYS = [
  'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
];

function fileExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function getWindowsRegistryCandidates() {
  if (PLATFORM !== 'win32') return [];

  const candidates = new Set();
  for (const key of WINDOWS_UNINSTALL_KEYS) {
    try {
      const stdout = execFileSync('reg', ['query', key, '/s'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000,
        windowsHide: true,
        maxBuffer: 5 * 1024 * 1024,
      });

      for (const block of stdout.split(/\r?\n\r?\n/)) {
        if (!/DisplayName\s+REG_\w+\s+.*LibreOffice/i.test(block)) continue;
        const match = block.match(/InstallLocation\s+REG_\w+\s+(.+)/i);
        const installLocation = match?.[1]?.trim();
        if (installLocation) {
          candidates.add(path.join(installLocation, 'program', 'soffice.exe'));
        }
      }
    } catch {
      // Registry lookup is best-effort; explicit paths and LO_SOFFICE_PATH still apply.
    }
  }
  return [...candidates];
}

function main() {
  console.log('=== LibreOffice Setup Checker ===\n');

  // 1. Env override
  if (ENV_OVERRIDE) {
    if (fileExists(ENV_OVERRIDE)) {
      console.log(`✅ LO_SOFFICE_PATH is set and valid:`);
      console.log(`   ${ENV_OVERRIDE}\n`);
      return 0;
    }
    console.log(`⚠️  LO_SOFFICE_PATH is set but file not found:`);
    console.log(`   ${ENV_OVERRIDE}\n`);
  }

  // 2. Auto-detect
  const candidates = [...(CANDIDATES[PLATFORM] || []), ...getWindowsRegistryCandidates()];
  for (const candidate of candidates) {
    if (fileExists(candidate)) {
      console.log(`✅ LibreOffice found:`);
      console.log(`   ${candidate}\n`);
      return 0;
    }
  }

  // 3. Not found — print instructions
  console.log(`❌ LibreOffice not found on ${PLATFORM}.\n`);
  console.log('Install it with one of the following commands:\n');

  if (PLATFORM === 'win32') {
    console.log(INSTALL_COMMANDS.win32);
    console.log('  # Or download manually from https://www.libreoffice.org/download/download');
  } else if (PLATFORM === 'darwin') {
    console.log(INSTALL_COMMANDS.darwin);
    console.log('  # Or download manually from https://www.libreoffice.org/download/download');
  } else if (PLATFORM === 'linux') {
    console.log(INSTALL_COMMANDS.linux);
    console.log('  # For Alpine:');
    console.log('  #   apk add libreoffice');
    console.log('  # For Fedora/RHEL:');
    console.log('  #   sudo dnf install libreoffice');
  } else {
    console.log('  (Unknown platform — install LibreOffice manually)');
    console.log('  https://www.libreoffice.org/download/download');
  }

  console.log('\nAfter installation, either restart your terminal or set:');
  console.log(`  export LO_SOFFICE_PATH=/path/to/soffice`);
  console.log('\n');
  return 1;
}

process.exit(main());

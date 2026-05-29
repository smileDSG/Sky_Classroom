/**
 * remove-i18n.mjs
 *
 * 自动将项目中所有 t('key') 调用替换为 zh-CN.json 中对应的中文值，
 * 并删除 useI18n 相关的 import 和 hook 调用。
 *
 * 用法: node scripts/remove-i18n.mjs [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALE_FILE = path.join(ROOT, 'lib/i18n/locales/zh-CN.json');
const DRY_RUN = process.argv.includes('--dry-run');

// ── 1. 读取并展平 locale JSON ──────────────────────────────────

function flatten(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'object' && item !== null) {
          Object.assign(result, flatten(item, `${fullKey}.${i}`));
        } else {
          result[`${fullKey}.${i}`] = item;
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flatten(value, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

const locale = JSON.parse(fs.readFileSync(LOCALE_FILE, 'utf-8'));
const keyMap = flatten(locale);
console.log(`[locale] 已加载 ${Object.keys(keyMap).length} 个翻译 key`);

// ── 2. 收集目标文件 ──────────────────────────────────────────

function findFiles(dir, exts, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.git', 'dist'].includes(entry.name)) continue;
      findFiles(full, exts, results);
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

const allFiles = findFiles(ROOT, ['.ts', '.tsx']);
const targetFiles = allFiles.filter((f) => {
  const content = fs.readFileSync(f, 'utf-8');
  return content.includes("useI18n") || content.includes("from '@/lib/i18n'");
});

console.log(`[scan] 找到 ${targetFiles.length} 个需要处理的文件`);

// ── 3. 替换逻辑 ──────────────────────────────────────────────

let totalReplacements = 0;
let totalFilesModified = 0;
const unmatchedKeys = new Set();

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceSimpleT(content) {
  // 匹配 t('key') 或 t("key") — 不含参数
  const simpleRegex = /\bt\(\s*['"]([^'"]+)['"]\s*\)/g;
  return content.replace(simpleRegex, (match, key) => {
    const val = keyMap[key];
    if (val === undefined) {
      unmatchedKeys.add(key);
      return match; // 保留原样
    }
    totalReplacements++;
    // 如果值包含单引号，用双引号包裹；否则用单引号
    if (val.includes("'") && !val.includes('"')) {
      return `"${val}"`;
    } else if (val.includes("'") && val.includes('"')) {
      return `\`${val.replace(/`/g, '\\`')}\``;
    }
    return `'${val}'`;
  });
}

function replaceParameterizedT(content) {
  // 匹配 t('key', { param: value, ... })
  const paramRegex = /\bt\(\s*['"]([^'"]+)['"]\s*,\s*\{([^}]+)\}\s*\)/g;
  return content.replace(paramRegex, (match, key, paramsStr) => {
    const val = keyMap[key];
    if (val === undefined) {
      unmatchedKeys.add(key);
      return match;
    }
    totalReplacements++;
    // 解析参数: "param: value" 或 "param: expression"
    const paramPairs = {};
    for (const part of paramsStr.split(',')) {
      const trimmed = part.trim();
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      const pKey = trimmed.substring(0, colonIdx).trim();
      const pVal = trimmed.substring(colonIdx + 1).trim();
      paramPairs[pKey] = pVal;
    }
    // 替换 {{param}} 为 ${value}
    let result = val;
    for (const [pKey, pVal] of Object.entries(paramPairs)) {
      result = result.replace(new RegExp(`\\{\\{${escapeRegExp(pKey)}\\}\\}`, 'g'), `\${${pVal}}`);
    }
    // 如果包含 ${}，用模板字符串
    if (result.includes('${')) {
      return '`' + result.replace(/`/g, '\\`') + '`';
    }
    // 否则普通字符串
    if (result.includes("'") && !result.includes('"')) {
      return `"${result}"`;
    }
    return `'${result}'`;
  });
}

function removeImports(content) {
  // 删除 useI18n import 行
  content = content.replace(
    /^.*import\s*\{[^}]*\buseI18n\b[^}]*\}\s*from\s*['"][^'"]*use-i18n['"];?\s*\n?/gm,
    ''
  );
  content = content.replace(
    /^.*import\s*\{[^}]*\buseI18n\b[^}]*\}\s*from\s*['"][^'"]*\/i18n['"];?\s*\n?/gm,
    ''
  );
  // 也处理 import { useI18n, resolveLocale } 等组合导入
  content = content.replace(
    /^(.*import\s*\{)([^}]*\buseI18n\b,?\s*)([^}]*)(\}\s*from\s*['"][^'"]*(?:use-i18n|i18n)['"];?\s*\n?)/gm,
    (m, pre, removed, rest, post) => {
      const cleaned = rest.replace(/^,\s*/, '').replace(/,\s*$/, '');
      if (!cleaned.trim()) return ''; // 整行删除
      return `${pre}${cleaned}${post}`;
    }
  );
  return content;
}

function removeHookUsage(content) {
  // 删除 const { t } = useI18n(); 行
  content = content.replace(
    /^\s*const\s*\{\s*t\s*(?:,\s*[^}]+)?\}\s*=\s*useI18n\(\);?\s*\n?/gm,
    ''
  );
  // 也处理 const { locale, setLocale, t } = useI18n();
  content = content.replace(
    /^\s*const\s*\{\s*[^}]*\bt\b[^}]*\}\s*=\s*useI18n\(\);?\s*\n?/gm,
    ''
  );
  return content;
}

function cleanUseMemoDeps(content) {
  // 移除 useMemo 依赖数组中的 , t 或 t,
  // 模式: }, [t]) 或 }, [t, other]) 或 }, [other, t])
  content = content.replace(/, t\]/g, ']');
  content = content.replace(/\[t, /g, '[');
  content = content.replace(/\[t\]/g, '[]');
  return content;
}

for (const filePath of targetFiles) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // 先替换 t() 调用（参数化的先处理）
  content = replaceParameterizedT(content);
  content = replaceSimpleT(content);
  // 删除 import 和 hook 调用
  content = removeImports(content);
  content = removeHookUsage(content);
  // 清理 useMemo 依赖
  content = cleanUseMemoDeps(content);

  if (content !== original) {
    totalFilesModified++;
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, content, 'utf-8');
    }
    console.log(`  ${DRY_RUN ? '[DRY] ' : ''}已修改: ${path.relative(ROOT, filePath)}`);
  }
}

// ── 4. 输出统计 ──────────────────────────────────────────────

console.log(`\n[完成] 修改了 ${totalFilesModified} 个文件，共 ${totalReplacements} 处替换`);
if (unmatchedKeys.size > 0) {
  console.log(`\n[警告] ${unmatchedKeys.size} 个 key 未在 zh-CN.json 中找到:`);
  for (const key of [...unmatchedKeys].sort()) {
    console.log(`  - ${key}`);
  }
}
if (DRY_RUN) {
  console.log('\n[提示] 这是 dry-run 模式，未实际写入文件。去掉 --dry-run 参数执行实际替换。');
}

import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import type { PPTDManifest, TemplatePage } from './pptd-types';

export function parsePPTD(manifestPath: string): PPTDManifest {
  const content = fs.readFileSync(manifestPath, 'utf-8');
  return yaml.load(content) as PPTDManifest;
}

export function parsePage(pagePath: string): TemplatePage {
  const content = fs.readFileSync(pagePath, 'utf-8');
  return yaml.load(content) as TemplatePage;
}

export function loadTemplate(templateDir: string): {
  manifest: PPTDManifest;
  pages: Record<string, TemplatePage>;
} {
  const dirName = path.basename(templateDir);
  const manifestPath = path.join(templateDir, `${dirName}.pptd`);
  const manifest = parsePPTD(manifestPath);
  const pages: Record<string, TemplatePage> = {};

  for (const pageFile of manifest.pages) {
    const fullPath = path.join(templateDir, pageFile);
    const pageName = path.basename(pageFile, '.page');
    pages[pageName] = parsePage(fullPath);
  }

  return { manifest, pages };
}

import type { PPTDManifest, TextStyle } from './pptd-types';

export class VariableResolver {
  private colors: Record<string, string>;
  private textStyles: Record<string, TextStyle>;

  constructor(manifest: PPTDManifest) {
    this.colors = manifest.theme.colors;
    this.textStyles = manifest.theme.textStyles;
  }

  resolveColor(value: string): string {
    if (!value) return value;
    if (value.startsWith('$')) {
      const key = value.slice(1);
      return this.colors[key] ?? value;
    }
    return value;
  }

  resolveStyle(styleRef: string): TextStyle | null {
    if (!styleRef) return null;
    if (styleRef.startsWith('$')) {
      const key = styleRef.slice(1);
      return this.textStyles[key] ?? null;
    }
    return null;
  }

  resolveAllInString(text: string): string {
    if (!text) return text;
    return text.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, key) => {
      return this.colors[key] ?? match;
    });
  }
}

export interface PPTDManifest {
  title: string;
  size: [number, number];
  theme: {
    colors: Record<string, string>;
    textStyles: Record<string, TextStyle>;
    tableStyles?: Record<string, TableStyle>;
  };
  pages: string[];
}

export interface TextStyle {
  fontSize: number;
  color: string;
  fontFamily: string;
  lineHeight: number;
  fontWeight?: string;
}

export interface TableStyle {
  fontSize: number;
  fontFamily: string;
  headerFill: string;
  headerColor: string;
  headerBold: boolean;
  bodyFill: string[];
  bodyColor: string;
  border: {
    style: string;
    width: number;
    color: string;
  };
}

export interface TemplateElement {
  elementId: string;
  elementType: 'text' | 'shape' | 'icon' | 'image' | 'line';
  bounds: [number, number, number, number];
  shapeName?: string;
  adjustments?: number[];
  fill?: { type: string; color: string };
  border?: { style: string; width: number; color: string };
  shadow?: { blur: number; color: string; offset: [number, number] };
  content?: {
    placeholder?: string;
    style?: string;
    color?: string;
    align?: [string, string];
    wrap?: boolean;
    text?: string;
  };
  iconName?: string;
  src?: string;
}

export interface TemplatePage {
  pageType: string;
  background: {
    type: 'solid' | 'gradient' | 'image';
    color?: string;
    gradientType?: string;
    angle?: number;
    stops?: Array<{ position: number; color: string }>;
  };
  elements: TemplateElement[];
}

export interface TemplateSlideData {
  templateName: string;
  pageName: string;
  page: TemplatePage;
  theme: PPTDManifest['theme'];
  manifest: PPTDManifest;
}

import type { TemplatePage, TemplateElement } from './pptd-types';

export interface PlaceholderValues {
  [placeholder: string]: string;
}

export function replacePlaceholders(page: TemplatePage, values: PlaceholderValues): TemplatePage {
  return {
    ...page,
    elements: page.elements.map((el) => replaceInElement(el, values)),
  };
}

function replaceInElement(el: TemplateElement, values: PlaceholderValues): TemplateElement {
  if (!el.content?.placeholder) return el;

  const placeholder = el.content.placeholder;
  const newValue = values[placeholder];

  if (newValue === undefined) return el;

  // If value already contains HTML tags, use it directly; otherwise wrap in <p>
  const text = newValue.trim().startsWith('<') ? newValue : `<p>${escapeHtml(newValue)}</p>`;

  return {
    ...el,
    content: {
      ...el.content,
      text,
    },
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ═══════════════════════════════════════════════════════════════
// StructuredContent → PlaceholderValues mapping
// ═══════════════════════════════════════════════════════════════

export function extractPlaceholderValues(
  content: Record<string, unknown>,
  pageType: string,
): PlaceholderValues {
  const values: PlaceholderValues = {};
  const type = content.type as string;

  // Universal fields
  if (content.title) values.title = String(content.title);
  if (content.subtitle) values.subtitle = String(content.subtitle);
  if (content.body) values.body = String(content.body);
  if (content.instructor) values.instructor = String(content.instructor);
  if (content.date) values.date = String(content.date);
  if (content.chapter_number) values.chapter_number = String(content.chapter_number);
  if (content.chapter_title) values.chapter_title = String(content.chapter_title);
  if (content.chapter_desc) values.chapter_desc = String(content.chapter_desc);
  if (content.conclusion) values.conclusion = String(content.conclusion);
  if (content.formula_main) values.formula_main = String(content.formula_main);
  if (content.formula_derivation) values.formula_derivation = String(content.formula_derivation);
  if (content.table_summary) values.table_summary = String(content.table_summary);
  if (content.image_url) values.image_url = String(content.image_url);
  if (content.image_caption) values.image_caption = String(content.image_caption);

  // Direct placeholder fields (used by tests and legacy callers)
  if (content.left_title) values.left_title = String(content.left_title);
  if (content.left_body) values.left_body = String(content.left_body);
  if (content.right_title) values.right_title = String(content.right_title);
  if (content.right_body) values.right_body = String(content.right_body);

  for (let i = 1; i <= 4; i++) {
    const bTitle = content[`bullet_${i}_title`];
    const bDesc = content[`bullet_${i}_desc`];
    if (bTitle) values[`bullet_${i}_title`] = String(bTitle);
    if (bDesc) values[`bullet_${i}_desc`] = String(bDesc);

    const cTitle = content[`card_${i}_title`];
    const cDesc = content[`card_${i}_desc`];
    if (cTitle) values[`card_${i}_title`] = String(cTitle);
    if (cDesc) values[`card_${i}_desc`] = String(cDesc);

    const sTitle = content[`step_${i}_title`];
    const sDesc = content[`step_${i}_desc`];
    if (sTitle) values[`step_${i}_title`] = String(sTitle);
    if (sDesc) values[`step_${i}_desc`] = String(sDesc);
  }

  // Type-specific mappings (StructuredContent schema → placeholders)
  switch (type) {
    case 'concept': {
      const cards = (content.cards ?? []) as Array<{ title: string; desc: string }>;
      if (cards.length > 0 && !values.body) {
        // Merge cards into body HTML for text.page
        values.body = cards
          .map((c) => `<p><strong>${escapeHtml(c.title)}</strong></p><p>${escapeHtml(c.desc)}</p>`)
          .join('');
      }
      if (content.summary && !values.body) {
        values.body =
          (values.body || '') +
          `<p style="margin-top:16px"><em>${escapeHtml(String(content.summary))}</em></p>`;
      }
      // Also fill card_1..4 placeholders for cards.page fallback
      for (let i = 0; i < Math.min(cards.length, 4); i++) {
        if (!values[`card_${i + 1}_title`]) values[`card_${i + 1}_title`] = cards[i].title;
        if (!values[`card_${i + 1}_desc`]) values[`card_${i + 1}_desc`] = cards[i].desc;
      }
      break;
    }

    case 'case': {
      const scenarios = (content.scenarios ?? []) as Array<{
        problem: string;
        solution: string;
      }>;
      if (scenarios.length > 0 && !values.left_body) {
        const s = scenarios[0];
        values.left_title = s.problem.slice(0, 40);
        values.left_body = s.problem;
        values.right_title = s.solution.slice(0, 40);
        values.right_body = s.solution;
      }
      if (content.highlight && !values.conclusion) {
        values.conclusion = String(content.highlight);
      }
      break;
    }

    case 'compare': {
      const left = content.left as { title: string; items: string[] } | undefined;
      const right = content.right as { title: string; items: string[] } | undefined;
      if (left && !values.left_body) {
        values.left_title = left.title;
        values.left_body = left.items.map((item) => `• ${item}`).join('<br/>');
      }
      if (right && !values.right_body) {
        values.right_title = right.title;
        values.right_body = right.items.map((item) => `• ${item}`).join('<br/>');
      }
      break;
    }

    case 'process': {
      const steps = (content.steps ?? []) as Array<{
        num: string;
        title: string;
        desc: string;
      }>;
      for (let i = 0; i < Math.min(steps.length, 4); i++) {
        if (!values[`step_${i + 1}_title`]) {
          values[`step_${i + 1}_title`] = `${steps[i].num}. ${steps[i].title}`;
        }
        if (!values[`step_${i + 1}_desc`]) {
          values[`step_${i + 1}_desc`] = steps[i].desc;
        }
      }
      break;
    }

    case 'summary': {
      const keyPoints = (content.keyPoints ?? []) as string[];
      // Map to bullet_N_title for bullets.page
      for (let i = 0; i < Math.min(keyPoints.length, 4); i++) {
        if (!values[`bullet_${i + 1}_title`]) values[`bullet_${i + 1}_title`] = keyPoints[i];
        if (!values[`bullet_${i + 1}_desc`]) values[`bullet_${i + 1}_desc`] = '';
      }
      // Also create a body for text.page fallback
      if (!values.body) {
        values.body = keyPoints.map((kp) => `<p>• ${escapeHtml(kp)}</p>`).join('');
      }
      if (content.preview && !values.body?.includes(String(content.preview))) {
        values.body += `<p style="margin-top:12px"><em>${escapeHtml(String(content.preview))}</em></p>`;
      }
      break;
    }

    case 'table': {
      const headers = (content.headers ?? []) as string[];
      const rows = (content.rows ?? []) as string[][];
      if (!values.body) {
        let html = '';
        if (headers.length > 0) {
          html += `<p><strong>${escapeHtml(headers.join(' | '))}</strong></p>`;
        }
        for (const row of rows.slice(0, 6)) {
          html += `<p>${escapeHtml(row.join(' | '))}</p>`;
        }
        values.body = html;
      }
      if (content.summary && !values.body?.includes(String(content.summary))) {
        values.body += `<p style="margin-top:12px"><em>${escapeHtml(String(content.summary))}</em></p>`;
      }
      break;
    }

    case 'quote': {
      // title and body already handled above
      if (content.caption && values.body) {
        values.body += `<p style="margin-top:12px;text-align:right"><em>— ${escapeHtml(String(content.caption))}</em></p>`;
      }
      break;
    }

    case 'sidebar': {
      if (!values.left_body) values.left_body = content.body ? String(content.body) : '';
      if (!values.right_body)
        values.right_body = content.main_body ? String(content.main_body) : '';
      break;
    }

    case 'image_large': {
      // image_large.page has no placeholders — map to body for display
      if (content.image_caption && !values.body) {
        values.body = `<p><em>${escapeHtml(String(content.image_caption))}</em></p>`;
      }
      break;
    }

    case 'image_half': {
      if (!values.left_body) values.left_body = content.body ? String(content.body) : '';
      if (!values.right_body && content.image_caption) {
        values.right_body = String(content.image_caption);
      }
      break;
    }
  }

  return values;
}

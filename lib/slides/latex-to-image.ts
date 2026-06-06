/**
 * LaTeX → PNG Image Renderer
 *
 * Uses MathJax 4.x to generate SVG from LaTeX, then renders the SVG
 * to PNG via @napi-rs/canvas. This replaces the fragile OMML chain
 * (temml → MathML → mathml2omml → postProcess) with a robust
 * LaTeX → SVG → PNG pipeline.
 */
import { createCanvas, Image } from '@napi-rs/canvas';
import { createLogger } from '@/lib/logger';

const log = createLogger('LatexToImage');

// ── MathJax singleton ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mathJaxInstance: any = null;

async function getMathJax() {
  if (mathJaxInstance) return mathJaxInstance;

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — mathjax has no bundled types
  const mathjax: any = await import('mathjax');
  const mj = await mathjax.init({
    loader: { load: ['input/tex', 'output/svg'] },
    tex: { packages: ['base', 'ams'] },
  });

  mathJaxInstance = mj;
  log.info('MathJax initialized for SVG rendering');
  return mathJaxInstance;
}

// ── SVG → PNG ─────────────────────────────────────────────────────

const EX_TO_PX_SCALE = 14; // scale factor: 1ex ≈ 14px at default font size

export interface RenderedFormula {
  buffer: Buffer;
  width: number;
  height: number;
}

/**
 * Render a LaTeX string to a PNG buffer.
 *
 * @param latex   Raw LaTeX source (ASCII, not Unicode)
 * @param options scale: multiplier for default size (default 1.0)
 *                bgColor: background color hex (default 'FFFFFF')
 */
export async function renderLatexToPng(
  latex: string,
  options: { scale?: number; bgColor?: string } = {},
): Promise<RenderedFormula | null> {
  const { scale = 1.0, bgColor = 'FFFFFF' } = options;

  try {
    const MathJax = await getMathJax();
    const svgNode = MathJax.tex2svg(latex, { display: true });
    const svgString = MathJax.startup.adaptor.innerHTML(svgNode);

    // Parse SVG dimensions (in ex units)
    const widthMatch = svgString.match(/width="([0-9.]+)ex"/);
    const heightMatch = svgString.match(/height="([0-9.]+)ex"/);

    if (!widthMatch || !heightMatch) {
      log.warn('MathJax SVG missing dimensions');
      return null;
    }

    const widthEx = parseFloat(widthMatch[1]);
    const heightEx = parseFloat(heightMatch[1]);

    const widthPx = Math.max(16, Math.ceil(widthEx * EX_TO_PX_SCALE * scale));
    const heightPx = Math.max(16, Math.ceil(heightEx * EX_TO_PX_SCALE * scale));

    // Replace ex dimensions with px for canvas rendering
    const resizedSvg = svgString
      .replace(/width="[0-9.]+ex"/, `width="${widthPx}px"`)
      .replace(/height="[0-9.]+ex"/, `height="${heightPx}px"`);

    const canvas = createCanvas(widthPx, heightPx);
    const ctx = canvas.getContext('2d');

    // Fill background
    ctx.fillStyle = `#${bgColor}`;
    ctx.fillRect(0, 0, widthPx, heightPx);

    // Draw SVG onto canvas
    const img = new Image();
    img.src = Buffer.from(resizedSvg);

    // Synchronous drawImage after brief delay to ensure Image is parsed
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        try {
          ctx.drawImage(img, 0, 0, widthPx, heightPx);
          resolve();
        } catch (err) {
          reject(err);
        }
      }, 50);
      img.onerror = (err) => {
        clearTimeout(timeout);
        reject(new Error(String(err)));
      };
    });

    const pngBuffer = canvas.toBuffer('image/png');
    return { buffer: pngBuffer, width: widthPx, height: heightPx };
  } catch (err) {
    log.warn(`LaTeX to PNG failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

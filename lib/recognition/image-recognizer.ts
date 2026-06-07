/**
 * Image recognizer — recognizes problem text from images using vision models.
 * Primary: LLM vision API (GPT-4o / Claude). Fallback: Tesseract.js.
 */

import { createLogger } from '@/lib/logger';
import type { ImageRecognitionResult, RecognizedProblem } from '@/lib/solve/types';
import { preprocessImage } from './image-preprocessor';
import { splitProblems } from './multi-problem-splitter';
import { extractFormulas } from './formula-extractor';

const log = createLogger('ImageRecognizer');

export interface RecognizeOptions {
  crop?: boolean;
  enhance?: boolean;
  removeShadow?: boolean;
  splitMultiple?: boolean;
  provider?: 'vision-llm' | 'tesseract';
}

/**
 * Recognize text from a problem image.
 * Handles: preprocessing, multi-problem splitting, OCR, formula extraction.
 */
export async function recognizeImage(
  imageBlob: Blob,
  options: RecognizeOptions = {},
): Promise<ImageRecognitionResult> {
  const {
    crop = true,
    enhance = true,
    removeShadow = true,
    splitMultiple = true,
    provider = 'vision-llm',
  } = options;

  // Preprocess
  const preprocessed = await preprocessImage(imageBlob, {
    crop,
    enhance,
    removeShadow,
  });

  // Try splitting
  let problemImages: { blob: Blob; index: number }[] = [];
  if (splitMultiple) {
    try {
      const regions = await splitProblems(preprocessed);
      problemImages = regions.map((r, i) => ({ blob: r.imageData, index: i }));
    } catch (err) {
      log.warn('Multi-problem split failed, treating as single problem:', err);
      problemImages = [{ blob: preprocessed, index: 0 }];
    }
  } else {
    problemImages = [{ blob: preprocessed, index: 0 }];
  }

  // OCR each problem
  const problems: RecognizedProblem[] = [];
  let allText = '';
  let allLatex = '';

  for (const { blob } of problemImages) {
    const result = await performOCR(blob, provider);
    problems.push(result);
    allText += result.text + '\n';
    if (result.latex) {
      allLatex += result.latex + '\n';
    }
  }

  return {
    text: allText.trim(),
    latex: allLatex.trim(),
    problemCount: problems.length,
    problems,
  };
}

async function performOCR(
  imageBlob: Blob,
  provider: 'vision-llm' | 'tesseract',
): Promise<RecognizedProblem> {
  if (provider === 'vision-llm') {
    return recognizeWithVisionLLM(imageBlob);
  }

  // Tesseract fallback — lazy loaded
  return recognizeWithTesseract(imageBlob);
}

async function recognizeWithVisionLLM(imageBlob: Blob): Promise<RecognizedProblem> {
  const base64 = await blobToBase64(imageBlob);

  // Call the server-side API which handles vision model invocation
  const response = await fetch('/api/sky/solve/recognize', {
    method: 'POST',
    body: (() => {
      const fd = new FormData();
      fd.append('image', imageBlob, 'problem.png');
      return fd;
    })(),
  });

  if (!response.ok) {
    // Fallback to Tesseract if API fails
    log.warn('Vision API failed, falling back to Tesseract');
    return recognizeWithTesseract(imageBlob);
  }

  const data = await response.json();
  const text = data.data?.text || '';
  const { text: cleanedText, latex } = extractFormulas(text);

  return {
    image: base64,
    text: cleanedText,
    latex,
  };
}

async function recognizeWithTesseract(imageBlob: Blob): Promise<RecognizedProblem> {
  const base64 = await blobToBase64(imageBlob);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tesseract.js is an optional dependency
    const TesseractModule = await import('tesseract.js' as never).catch(() => null);
    if (!TesseractModule) {
      log.warn('tesseract.js not installed, returning empty recognition');
      return { image: base64, text: '', latex: '' };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (TesseractModule as any).recognize(imageBlob, 'chi_sim+eng', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          log.debug(`Tesseract progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    const text = data.text || '';
    const { text: cleanedText, latex } = extractFormulas(text);

    return {
      image: base64,
      text: cleanedText,
      latex,
    };
  } catch (err) {
    log.error('Tesseract recognition failed:', err);
    return {
      image: base64,
      text: '',
      latex: '',
    };
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

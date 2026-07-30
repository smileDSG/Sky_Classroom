import { createCanvas } from '@napi-rs/canvas';
import type { SyntheticRecognitionCase } from './synthetic-generator';

const WIDTH = 1200;
const HEIGHT = 1600;

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function drawPaper(ctx: ReturnType<typeof createCanvas>['getContext']): void {
  ctx.fillStyle = '#f8f1df';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = 'rgba(116, 91, 49, 0.13)';
  ctx.lineWidth = 1;
  for (let y = 70; y < HEIGHT - 40; y += 72) {
    ctx.beginPath();
    ctx.moveTo(70, y);
    ctx.lineTo(WIDTH - 70, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(174, 60, 54, 0.25)';
  ctx.beginPath();
  ctx.moveTo(145, 50);
  ctx.lineTo(145, HEIGHT - 50);
  ctx.stroke();
}

function drawHandwrittenText(
  ctx: ReturnType<typeof createCanvas>['getContext'],
  text: string,
  x: number,
  y: number,
  fontFamily: string,
  jitter: number,
  random: () => number,
): void {
  ctx.font = `42px "${fontFamily}", "KaiTi", serif`;
  ctx.fillStyle = '#24333b';
  ctx.textBaseline = 'alphabetic';

  let cursor = x;
  for (const char of text) {
    const offsetY = (random() - 0.5) * jitter;
    const angle = (random() - 0.5) * 0.035;
    ctx.save();
    ctx.translate(cursor, y + offsetY);
    ctx.rotate(angle);
    ctx.fillText(char, 0, 0);
    ctx.restore();
    cursor += Math.max(26, ctx.measureText(char).width + 1);
  }
}

export function renderSyntheticCase(sample: SyntheticRecognitionCase, seed = 20260722): Buffer {
  const random = mulberry32(seed + sample.id.length * 97 + sample.id.charCodeAt(sample.id.length - 1));
  const base = createCanvas(WIDTH, HEIGHT);
  const baseContext = base.getContext('2d');
  drawPaper(baseContext);

  drawHandwrittenText(
    baseContext,
    sample.groundTruth.text,
    185,
    150,
    sample.rendering.fontFamily,
    sample.rendering.lineJitter,
    random,
  );

  let lineY = 245;
  for (const formula of sample.groundTruth.latex) {
    drawHandwrittenText(
      baseContext,
      formula.replaceAll('\\\\', ''),
      185,
      lineY,
      sample.rendering.fontFamily,
      sample.rendering.lineJitter,
      random,
    );
    lineY += 88;
  }

  baseContext.fillStyle = 'rgba(45, 47, 54, 0.05)';
  for (let i = 0; i < Math.round(sample.degradation.noise * 900); i += 1) {
    baseContext.fillRect(random() * WIDTH, random() * HEIGHT, 1.5, 1.5);
  }

  const output = createCanvas(WIDTH, HEIGHT);
  const outputContext = output.getContext('2d');
  outputContext.fillStyle = '#d9d2c3';
  outputContext.fillRect(0, 0, WIDTH, HEIGHT);
  outputContext.translate(WIDTH / 2, HEIGHT / 2);
  outputContext.rotate((sample.degradation.rotation * Math.PI) / 180);
  outputContext.globalAlpha = 1 - sample.degradation.shadow * 0.18;
  outputContext.drawImage(base, -WIDTH / 2, -HEIGHT / 2);
  outputContext.globalAlpha = 1;

  if (sample.degradation.shadow > 0) {
    outputContext.fillStyle = `rgba(30, 34, 40, ${sample.degradation.shadow * 0.16})`;
    outputContext.fillRect(-WIDTH / 2, -HEIGHT / 2, WIDTH * 0.16, HEIGHT);
  }

  outputContext.restore?.();
  return output.toBuffer('image/png');
}

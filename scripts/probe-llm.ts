import { resolveModel } from '@/lib/server/resolve-model';
import { generateText } from 'ai';

async function main() {
  const t = Date.now();
  const { model } = await resolveModel({ modelString: 'deepseek:deepseek-chat' });
  const r = await generateText({ model, prompt: '只回复 OK' });
  console.log(`OK ${Date.now() - t}ms :: ${String(r.text || '').slice(0, 30)}`);
}
main().catch((e) => {
  console.error('LLM 探针失败:', e?.message || e);
  process.exit(1);
});
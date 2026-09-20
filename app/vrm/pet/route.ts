// VRM 宠物资产的路由出口。
//
// Next 16 的静态文件服务只认白名单扩展名(.json/.png/.woff/.glb 等),
// 不认 .vrm —— 所以 `/vrm/pet.vrm` 直达 public 会被路由器兜底成首页。
// 这里用一条 route handler 读取 public 里的原始 VRM 文件并以
// `model/gltf-binary` 返回: three 的 GLTFLoader 不关心 URL/扩展名,
// 拿到字节即按 glTF 解析,字节与文件直读完全一致。
//
// 纯新增、可回滚:删掉本文件并把 modelPath 改回 `/vrm/pet.vrm` 即恢复。
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// 与 public/vrm/pet.vrm 同源(standalone 运行时 cwd=/app, public 同目录)
const FILE = join(process.cwd(), 'public', 'vrm', 'pet.vrm');

export const dynamic = 'force-dynamic';

export async function GET() {
  const buf = await readFile(FILE);
  return new Response(buf, {
    headers: {
      'Content-Type': 'model/gltf-binary',
      'Content-Length': String(buf.length),
      // 人物素材不变, 允许浏览器/代理长效缓存
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
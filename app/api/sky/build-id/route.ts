import { NextResponse } from 'next/server';

// 构建指纹接口: 返回「当前服务器镜像」的构建 id。客户端 STALE_GUARD 会拿它和自己打包时
// 内嵌的 NEXT_PUBLIC_BUILD_ID 比对 —— 不一致说明站点被重新部署过(长驻标签页该自刷新了)。
// NEXT_PUBLIC_ 在编译期被内联成字面量, 所以这里读到的就是本镜像构建时的那个 id。
export async function GET() {
  return NextResponse.json(
    { id: process.env.NEXT_PUBLIC_BUILD_ID || '' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
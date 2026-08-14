#!/usr/bin/env bash
# 验证：评委无需任何模型 Key 即可看到完整多智能体课堂
set -e
cd /e/01_Work/sky-classroom
export NODE_ENV=production
export PORT=3000
export NEXT_TELEMETRY_DISABLED=1
OUT=E:/01_Work/sky-classroom/_validate
mkdir -p "$OUT"

NODE=C:/Users/lenovo/.workbuddy/binaries/node/versions/22.22.2/node.exe

echo "== 启动生产服务器 (next start) =="
"$NODE" node_modules/next/dist/bin/next start -p 3000 > "$OUT/server.log" 2>&1 &
SRV=$!

echo "== 等待服务就绪 (最多 120s) =="
READY=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/sky/software-cup || true)
  if [ "$code" = "200" ]; then echo "READY after ~$((i*2))s (HTTP $code)"; READY=1; break; fi
  sleep 2
done
if [ "$READY" != "1" ]; then echo "SERVER DID NOT BECOME READY"; tail -30 "$OUT/server.log"; kill $SRV 2>/dev/null || true; exit 2; fi

echo "== 调用软件杯生成接口（不传任何模型 Key）=="
curl -s -X POST http://localhost:3000/api/sky/resource-generation/jobs \
  -H 'Content-Type: application/json' \
  -d '{"input":"我是软件工程大二学生，正在学人工智能导论，Python 基础还行，最困惑过拟合、模型评估和 RAG，想补上机器学习基础和智能体"}' \
  -o "$OUT/gen.json"
echo "saved -> $OUT/gen.json"

echo "== 解析结果 =="
"$NODE" -e '
const fs=require("fs");
const d=JSON.parse(fs.readFileSync("E:/01_Work/sky-classroom/_validate/gen.json","utf8"));
const data=d.data||{};
const resources=data.resources||[];
const agentTrace=data.agentTrace||[];
const learningPath=data.learningPath||[];
console.log("success:", d.success);
console.log("resources 数量:", resources.length);
console.log("agentTrace(多智能体轨迹) 数量:", agentTrace.length);
console.log("learningPath 数量:", learningPath.length);
console.log("generationMode:", data.generationMode, "(keyless 应为 demo_fallback)");
if(agentTrace.length){ console.log("轨迹示例:", agentTrace.slice(0,4).map(a=>a.agent+"/"+a.status).join(" | ")); }
console.log("JUDGE_ZERO_KEY_OK:", (d.success===true && resources.length>0 && agentTrace.length>0));
'
echo "== 页面可访问性 =="
curl -s -o /dev/null -w "GET /sky/software-cup -> %{http_code}\n" --max-time 5 http://localhost:3000/sky/software-cup
curl -s -o /dev/null -w "GET / (首页)      -> %{http_code}\n" --max-time 5 http://localhost:3000/

kill $SRV 2>/dev/null || true
echo "== 验证结束 =="

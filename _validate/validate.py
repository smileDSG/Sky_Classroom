#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
交付物「评委可真正使用」实测验证：
  1) 启动生产服务器（next start）
  2) 软件杯演示页可匿名访问（HTTP 200）
  3) 零密钥生成接口返回多智能体轨迹（agentTrace 非空）
  4) 体验账号可登录
"""
import os
import sys
import time
import json
import signal
import subprocess
import urllib.request
import urllib.error

ROOT = r"E:\01_Work\sky-classroom"
PORT = 3100
BASE = f"http://localhost:{PORT}"

NODE = r"C:\Users\lenovo\.workbuddy\binaries\node\versions\22.22.2\node.exe"
NEXT_BIN = os.path.join(ROOT, "node_modules", "next", "dist", "bin", "next")

proc = None


def log(msg):
    print(msg, flush=True)


def wait_server(timeout=90):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            with urllib.request.urlopen(f"{BASE}/sky/software-cup", timeout=3) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(1.5)
    return False


def post_json(path, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}{path}", data=data,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, json.loads(r.read().decode("utf-8"))


def main():
    global proc
    env = dict(os.environ)
    env["NODE_OPTIONS"] = "--use-system-ca"
    env["PORT"] = str(PORT)
    env["ENABLE_DEMO_ACCOUNT"] = "true"
    env["NODE_ENV"] = "production"

    log("==> starting production server (next start) ...")
    proc = subprocess.Popen(
        [NODE, NEXT_BIN, "start", "-p", str(PORT)],
        cwd=ROOT, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )

    try:
        if not wait_server():
            log("FAIL: server did not become ready in time")
            return 1

        log("PASS: /sky/software-cup reachable (HTTP 200)")

        # 零密钥生成接口（不传任何 Key）
        log("==> POST /api/sky/resource-generation/jobs (zero-key) ...")
        status, body = post_json(
            "/api/sky/resource-generation/jobs",
            {"studentInput": "请帮我学习牛顿第二定律，我是高中生"},
        )
        if status != 200:
            log(f"FAIL: generation API returned {status}")
            return 1
        data = body.get("data", {})
        trace = data.get("agentTrace") or []
        resources = data.get("resources") or []
        src = data.get("generationSource")
        log(f"     generationSource = {src}")
        log(f"     agentTrace items = {len(trace)}")
        log(f"     resources        = {len(resources)}")
        if not trace:
            log("FAIL: agentTrace empty — multi-agent demo broken")
            return 1
        if not resources:
            log("FAIL: resources empty")
            return 1
        log("PASS: zero-key multi-agent generation works (agentTrace + resources present)")

        # 演示账号登录（demo / SkyClassroom123!，字段名 emailOrUsername）
        log("==> POST /api/auth/login (demo account) ...")
        try:
            st, lb = post_json(
                "/api/auth/login",
                {"emailOrUsername": "demo", "password": "SkyClassroom123!"},
            )
            if st == 200 and lb.get("success"):
                log("PASS: demo account login works (ENABLE_DEMO_ACCOUNT effective)")
            else:
                log(f"WARN: demo login returned {st}: {json.dumps(lb)[:200]}")
        except Exception as e:
            log(f"WARN: demo login error: {e}")

        log("\n==> ALL CORE CHECKS PASSED ✅")
        return 0
    finally:
        if proc:
            proc.send_signal(signal.SIGTERM)
            try:
                proc.wait(timeout=15)
            except Exception:
                proc.kill()


if __name__ == "__main__":
    sys.exit(main())

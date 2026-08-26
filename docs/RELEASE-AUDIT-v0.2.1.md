# Sky Classroom v0.2.1 发布审计

审计日期：2026-08-26  
审计范围：根项目 Next.js API、学情/课堂/幻灯片/资源生成、软件杯入口、Docker/Vercel 配置、单元测试。

## 版本结论

- 根项目 `package.json`：`0.2.1`
- `software-cup-A3` 子模块：`0.2.1`
- 根项目已有 `v0.2.1` 发布记录和 changelog
- 当前分支已创建本地 `v0.2.1` tag，未推送 GitHub
- 建议展示版本统一标记为 `v0.2.1`；只有团队决定把本次版本定义为首个正式稳定版时，才整体改为 `v1.0.0`

## 本次已修复

- 关闭生产环境默认 `admin/123` 自动建号；管理员 seed 改为显式开关和强密码。
- 用户画像、dashboard、job、教学反馈、测验写入等路径使用服务端身份和归属校验。
- 高成本 LLM、图片、视频、TTS、课堂、幻灯片、软件杯生成接口增加额度控制。
- 外部 provider 探测接口增加 IP 限流；Azure voice 探测增加超时。
- 记忆卡片接口改为登录后使用，注入服务端学情投影；不再把用户生成内容写入共享知识库。
- 知识库 `tags` 兼容 JSON 数组、单字符串和旧 CSV 数据。
- 生产无 MySQL/Supabase 时拒绝静默落到内存存储，避免重启后用户数据丢失。
- 资源 job 查询不再伪造完成状态；同步资源接口明确返回 `410`。
- PPTX 导出/预览增加 IP 限流。

## 发布阻断项

### P0：上线前必须处理

1. **持久化依赖必须可用**：生产配置 `MYSQL_DATABASE` 或 `SUPABASE_URL`、对应凭证，并启动后检查 `/api/health`。否则个人资料、错题、答题记录等功能会返回存储不可用。
2. **异步 job 仍是进程内状态**：教学、课堂、幻灯片、云端出题 job 在多实例、serverless 重启或发布后可能丢失。展示环境使用单实例；正式多实例前改为共享 job/队列存储。
3. **分享 token 仍是进程内 Map**：重启或多实例会失效。展示前不要依赖跨实例分享；正式使用前迁移到持久化存储。
4. **生产密钥必须检查**：`JWT_SECRET`、LLM/TTS/ASR/图片/视频 provider key、`ENABLE_ADMIN_SEED=false`、强密码、数据库连接。

## P1：展示前建议处理或明确规避

- quota 是“检查后记录”，并发请求可能短暂超额；正式计费需要数据库原子计数/Redis。
- 限流器、缓存、job store 都是进程内实现，多实例不可靠；当前适合单实例展示。
- `memory-cards` 已禁止匿名调用；旧 dashboard/workshop/personalization-context 仍保留 demo fallback，不能当真实用户数据源。
- provider verify、OCR/import、外部搜索仍可能产生上游费用；展示时限制 provider 和输入文件大小，正式环境增加更细额度和管理员审计。
- Docker 未自带数据库卷；`docker-compose.yml` 仅启动应用，不能把 `/app/data` 当用户数据持久层。
- `software-cup-A3` 是独立 Git 子模块；根仓库 tag 只固定子模块指针，子模块自身仍需单独确认 tag/release。

## 验证记录

- `git diff --check`：通过。
- 记忆卡片学情测试：1 文件、3 tests 通过。
- 存储、账单和学情定向测试：7 文件、45 tests 通过。
- 最新全量 Vitest：359 files / 3352 tests passed，83 files / 299 tests failed，1 skipped；不能作为展示放行依据，需先清理失败集。
- 最新 `npm run build`：通过；TypeScript、123 个静态页和路由收集均通过。仍有 provider-config/composability 动态扫描约 1.27 万文件的构建警告。
- `npm run lint`、Prettier check：本机 `node_modules` 读取受 `EPERM` 阻断，未完成。

## 展示前清单

1. 单实例启动，确认数据库连通，访问 `/api/health`。
2. 使用真实展示账号登录；不要公开默认 admin 密码。
3. 只配置可用 provider；逐项验证聊天、出题、授课、课堂、幻灯片、PPTX 导出、资源生成。
4. 用新账号验证：用户 A 看不到用户 B 的 profile、job、错题、答题记录。
5. 关闭或限制外部 provider 探测、OCR、图片/视频生成，避免现场消耗额度。
6. 在干净环境完成 `pnpm check`、`pnpm lint`、`npx tsc --noEmit`、定向 Vitest 和主流程 Playwright。
7. 通过后确认目标 remote，再 push 当前 commit 和 `v0.2.1` tag。

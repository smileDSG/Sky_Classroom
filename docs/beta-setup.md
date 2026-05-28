# Beta 内测版部署指南

## 1. 数据库迁移

在 Supabase SQL Editor 中执行:
- `migrations/001_beta_system.sql` (已存在)
- `migrations/002_beta_feedback.sql` (新增)

## 2. 环境变量

在 `.env.local` 中添加/确认:

```env
# 开启 beta 门禁模式
BETA_MODE=true

# 全局访问密码 (用于 cookie 签名 + ACCESS_CODE 备选)
ACCESS_CODE=your-secret-beta-password

# Supabase (已有)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 3. 生成邀请码

```bash
# 生成 20 个可用 1 次的邀请码，30 天过期
npx tsx scripts/beta/invite-cli.ts create --count 20 --uses 1 --days 30 --prefix BETA

# 查看已生成的邀请码
npx tsx scripts/beta/invite-cli.ts list

# 撤销某个邀请码
npx tsx scripts/beta/invite-cli.ts revoke BETA-XXXXX
```

## 4. 启动

```bash
pnpm dev
```

- 访问 `http://localhost:3000` → 会跳转到 `/beta/gate` 要求输入邀请码
- 验证成功后可正常使用
- 页面左上角显示 "BETA v0.2.1" 徽章
- 右下角有 🐛 反馈按钮
- 访问 `/beta/test-checklist` 查看测试清单
- 访问 `/beta/admin` 查看反馈管理后台

## 5. 生产部署 (Vercel)

```bash
git push origin beta-v1
```

在 Vercel 项目设置中添加 `BETA_MODE=true` 环境变量即可。

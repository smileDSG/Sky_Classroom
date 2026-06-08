# API Key Pool 操作文档

## 1. 简介

API Key Pool 是一个通用的 API 密钥池管理系统，支持按 Provider 分组管理多个 API Key，通过轮询策略实现负载均衡，避免单个 Key 触发 rate limit。

### 核心能力

- **按 Provider 分组**：每个 LLM 供应商（openai、deepseek、claude 等）独立管理多个 Key
- **轮询负载均衡**：每次请求自动选取下一个可用 Key，均匀分散压力
- **加密存储**：Key 落库前使用 AES-256-GCM 加密，数据库泄露也无法直接读取明文
- **自动限流处理**：收到 429 时自动标记该 Key 为限流状态，60 秒后自动恢复
- **使用统计**：记录每个 Key 的累计调用次数和错误次数

---

## 2. 环境准备

### 2.1 执行数据库迁移

连接到 MySQL，执行建表 SQL：

```bash
mysql -u root -p sky_classroom < migrations/005_api_key_pool.sql
```

或手动执行：

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id                 VARCHAR(36) PRIMARY KEY,
  provider           VARCHAR(50) NOT NULL,
  api_key            VARCHAR(512) NOT NULL,
  base_url           VARCHAR(512),
  label              VARCHAR(100),
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  priority           INT NOT NULL DEFAULT 0,
  request_count      BIGINT NOT NULL DEFAULT 0,
  error_count        BIGINT NOT NULL DEFAULT 0,
  last_used_at       DATETIME,
  last_error_at      DATETIME,
  rate_limited_until DATETIME,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_provider_active (provider, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.2 设置加密密钥

在 `.env.local` 中添加：

```bash
API_KEY_POOL_SECRET=<64位hex字符串>
```

生成密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **重要**：此密钥用于加密数据库中的 API Key。丢失密钥将导致已有 Key 无法解密。请妥善备份。

---

## 3. API 接口

### 3.1 添加 Key

**POST** `/api/keys`

```json
{
  "provider": "openai",
  "apiKey": "sk-xxxxxxxxxxxx",
  "baseUrl": "https://api.openai.com/v1",
  "label": "团队账号-1",
  "priority": 0
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| provider | string | 是 | 提供商标识，如 `openai`、`deepseek`、`claude` |
| apiKey | string | 是 | API Key 明文 |
| baseUrl | string | 否 | 自定义 endpoint |
| label | string | 否 | 备注标签 |
| priority | number | 否 | 优先级，默认 0（预留功能） |

响应：

```json
{
  "success": true,
  "key": {
    "id": "uuid-xxx",
    "provider": "openai",
    "apiKey": "sk-xxxxxxxxxxxx",
    "label": "团队账号-1",
    "isActive": true,
    "requestCount": 0,
    "errorCount": 0
  }
}
```

### 3.2 查询 Key 列表

**GET** `/api/keys?provider=openai`

- `provider` 参数可选，不传则返回所有 Provider 的 Key
- 返回的 Key 已脱敏处理（如 `sk-1***abcd`）

响应：

```json
{
  "success": true,
  "keys": [
    {
      "id": "uuid-xxx",
      "provider": "openai",
      "apiKey": "sk-1***abcd",
      "label": "团队账号-1",
      "isActive": true,
      "requestCount": 150,
      "errorCount": 3,
      "lastUsedAt": "2026-05-30T12:00:00Z"
    }
  ]
}
```

### 3.3 更新 Key

**PATCH** `/api/keys/{id}`

```json
{
  "label": "新标签",
  "isActive": false,
  "apiKey": "sk-new-key-xxx"
}
```

所有字段均可选，只传需要修改的字段。

### 3.4 删除 Key

**DELETE** `/api/keys/{id}`

```json
{
  "success": true,
  "deleted": true
}
```

### 3.5 获取下一个可用 Key（轮询）

**POST** `/api/keys/pick`

```json
{
  "provider": "openai"
}
```

响应：

```json
{
  "success": true,
  "apiKey": "sk-xxxxxxxxxxxx",
  "baseUrl": "https://api.openai.com/v1",
  "keyId": "uuid-xxx",
  "index": 0
}
```

> 此接口供业务代码内部调用，返回解密后的 Key 明文。轮询策略保证每次返回不同的 Key。

---

## 4. 业务集成

### 4.1 在代码中使用

```typescript
import { pickKey, reportSuccess, reportError } from '@/lib/api-key-pool/pool';

// 获取下一个可用 Key
const { key } = await pickKey('openai');

try {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: { 'Authorization': `Bearer ${key.apiKey}` },
    // ...
  });

  if (response.status === 429) {
    // 报告错误，自动标记限流 60 秒
    await reportError(key.id, 429);
  } else {
    // 报告成功
    await reportSuccess(key.id);
  }
} catch (err) {
  await reportError(key.id, 500);
}
```

### 4.2 轮询行为说明

- 内存中维护每个 Provider 的轮询索引
- 每次 `pick()` 返回下一个可用 Key
- 自动跳过已禁用（`isActive=false`）和限流中的 Key
- 如果所有 Key 都不可用，抛出 `NoAvailableKeyError`
- 缓存每 60 秒自动刷新，增删 Key 后调用 `refreshCache()` 立即生效

### 4.3 限流处理

- 收到 HTTP 429 时，调用 `reportError(keyId, 429)`
- 该 Key 自动标记为限流状态，60 秒内不再被选中
- 60 秒后自动恢复可用
- 收到其他错误（500 等）只记录错误计数，不影响可用性

---

## 5. 运维操作

### 5.1 批量添加 Key

```bash
# 添加多个 openai Key
for key in sk-key1 sk-key2 sk-key3; do
  curl -s -X POST http://localhost:3000/api/keys \
    -H 'Content-Type: application/json' \
    -d "{\"provider\":\"openai\",\"apiKey\":\"$key\"}"
done
```

### 5.2 查看 Key 使用情况

```bash
# 查看所有 Key 的调用统计
curl 'http://localhost:3000/api/keys' | jq '.keys[] | {label, requestCount, errorCount, lastUsedAt}'
```

### 5.3 临时禁用某个 Key

```bash
curl -s -X PATCH http://localhost:3000/api/keys/{id} \
  -H 'Content-Type: application/json' \
  -d '{"isActive": false}'
```

### 5.4 替换失效 Key

```bash
# 1. 查找需要替换的 Key
curl 'http://localhost:3000/api/keys?provider=openai'

# 2. 更新为新 Key
curl -s -X PATCH http://localhost:3000/api/keys/{id} \
  -H 'Content-Type: application/json' \
  -d '{"apiKey": "sk-new-key-xxx"}'
```

---

## 6. 安全注意事项

1. **加密密钥备份**：`API_KEY_POOL_SECRET` 丢失将导致所有已存 Key 无法解密，请离线备份
2. **接口鉴权**：当前 API 路由未加鉴权中间件，生产环境需配合 `middleware.ts` 限制为管理员访问
3. **日志脱敏**：确保日志中不打印解密后的 Key 明文
4. **HTTPS**：生产环境必须通过 HTTPS 传输 Key

---

## 7. 文件结构

```
lib/
  api-key-pool/
    types.ts              # 类型定义
    crypto.ts             # AES-256-GCM 加密/解密
    pool.ts               # 轮询选择器 + 缓存
  storage/
    dao/
      api-key-pool.ts     # 数据库 CRUD
migrations/
  005_api_key_pool.sql    # 建表 SQL
app/
  api/
    keys/
      route.ts            # GET 列表 / POST 添加
      [id]/
        route.ts          # PATCH 更新 / DELETE 删除
      pick/
        route.ts          # POST 获取下一个可用 Key
```

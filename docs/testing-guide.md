# 性能优化测试指南

## 1. 构建测试

### 1.1 TypeScript 编译检查
```bash
# 检查类型错误（忽略已有错误，只看新错误）
npx tsc --noEmit 2>&1 | grep -v "error TS2" | head -20
```

### 1.2 构建测试
```bash
# 尝试生产构建
npx next build 2>&1 | tail -30
```

**期望结果**: 构建成功（注意：项目中已有一些 pre-existing TS 错误，关注是否新增错误）

---

## 2. 功能测试

### 2.1 lodash 替换测试

**测试页面**: 幻灯片编辑器 (`/classroom/{id}`)

**测试步骤**:
1. 打开课堂，切换到编辑模式
2. 添加文本元素，输入内容
3. 点击空白处触发 blur（测试 debounce）
4. 选中多个元素（Ctrl/Shift + 点击），测试多选

**期望结果**: 
- 文本编辑正常，无延迟
- 空文本自动删除（300ms debounce）
- 多选元素 ID 不重复

### 2.2 Hybrid Job Store 测试

**测试页面**: 课堂生成流程

**测试步骤**:
1. 上传 PDF，创建课堂
2. 观察网络面板，`/api/generate-classroom/{jobId}` 轮询正常
3. 等待大纲生成完成，页面自动跳转
4. 刷新页面，状态保持

**期望结果**:
- Job 状态正确存储和读取
- 进度更新正常显示
- 完成后自动跳转

### 2.3 Chat API 优化测试

**测试页面**: 课堂对话界面

**测试步骤**:
1. 开始对话，发送消息
2. 连续对话超过 50 条
3. 观察第 51 条消息时，历史消息是否被截断
4. 测试 SSE 流是否正常

**期望结果**:
- 消息正常显示
- 超过 50 条后只保留最近 50 条
- SSE 流正常，无断开

### 2.4 ECharts 增量更新测试

**测试页面**: 包含图表的幻灯片

**测试步骤**:
1. 打开包含图表的幻灯片
2. 编辑数据（如修改柱状图数值）
3. 观察图表更新是否平滑

**期望结果**:
- 图表无闪烁，平滑过渡

---

## 3. 性能测试

### 3.1 Bundle 分析
```bash
# 分析构建产物大小
du -sh .next/static/
ls -lh .next/static/chunks/*.js | head -10
```

### 3.2 Lighthouse 测试
```bash
# 安装并运行 Lighthouse
npm install -g lighthouse
lighthouse http://localhost:3000 --output=html --output-path=./lighthouse-report.html
```

### 3.3 快速验证命令
```bash
# 检查 lodash 是否移除
grep -r "from 'lodash'" components/ lib/ --include="*.ts" --include="*.tsx"

# 检查 rate limiter 清理逻辑
grep -A 5 "CLEANUP_INTERVAL" lib/api/middleware/rate-limiter.ts
```

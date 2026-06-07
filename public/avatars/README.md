# 天空课堂新头像集

## 设计概述

全新的天空课堂头像采用**现代扁平化设计风格**，与平台的天空主题完美呼应：

- 🎨 **配色方案**：天蓝色系 + 渐变效果
- ☁️ **主题元素**：云朵、天空、阳光
- 👤 **角色设定**：老师、学生、助手等多种角色
- 📐 **技术规格**：SVG 矢量格式，支持任意缩放

## 头像预览

| 头像 | 文件名 | 角色 | 描述 |
|------|--------|------|------|
| 👨‍🏫 | `teacher-new.svg` | 老师 | 温和亲切的林老师，戴眼镜，有云朵徽章 |
| 🤔 | `curious-new.svg` | 学生 | 充满好奇心的提问者，大眼睛带问号 |
| 🧐 | `thinker-new.svg` | 学生 | 深思熟虑的思考者，紫色系 |
| 🫶 | `helper-new.svg` | 助手 | 热心助人，带爱心徽章，绿色系 |
| 📝 | `notetaker-new.svg` | 学生 | 认真记录的学霸，橙色系 |
| 👤 | `user-new.svg` | 用户 | 默认用户头像，中性设计 |
| 👨‍🎓 | `student-1.svg` | 学生 | 学霸小明，蓝色系 |
| 👩‍🎓 | `student-2.svg` | 学生 | 活泼小红，红色系带蝴蝶结 |

## 颜色系统

```typescript
const COLOR_SYSTEM = {
  primary: '#0ea5e9',      // 天蓝 - 老师
  secondary: '#38bdf8',    // 浅天蓝
  accent: '#f472b6',       // 粉色 - 好奇
  highlight: '#fbbf24',    // 金色 - 记录员
  success: '#10b981',      // 绿色 - 助手
  purple: '#8b5cf6',       // 紫色 - 思考者
}
```

## 使用方法

### 1. 直接使用路径

```tsx
// 在组件中引用
<img src="/avatars/teacher-new.svg" alt="林老师" />

// 或在代码中使用常量
import { SKY_AVATARS } from '@/components/roundtable/constants';
<img src={SKY_AVATARS.teacher} alt="老师" />
```

### 2. 更新默认头像配置

已在 `lib/constants/agent-defaults.ts` 中更新：

```typescript
export const AGENT_DEFAULT_AVATARS = [
  // 新头像 (优先)
  '/avatars/teacher-new.svg',
  '/avatars/helper-new.svg',
  '/avatars/curious-new.svg',
  '/avatars/thinker-new.svg',
  '/avatars/notetaker-new.svg',
  '/avatars/student-1.svg',
  '/avatars/student-2.svg',
  '/avatars/user-new.svg',
  // 旧头像 (兼容)
  '/avatars/teacher.png',
  // ...
];
```

### 3. 组件中的默认头像

```typescript
// components/roundtable/constants.ts
export const DEFAULT_TEACHER_AVATAR = '/avatars/teacher-new.svg';
export const DEFAULT_STUDENT_AVATAR = '/avatars/user-new.svg';
export const DEFAULT_USER_AVATAR = '/avatars/user-new.svg';
```

## 重新生成头像

如需修改设计，编辑 `scripts/generate-avatars.js` 后运行：

```bash
node scripts/generate-avatars.js
```

## 头像设计规范

### 画布规格
- 尺寸：280×280px
- 视口：0 0 280 280
- 圆角：140px (圆形头像)

### 角色设计要点
1. **老师**：天蓝色服装、眼镜、云朵徽章、温和微笑
2. **好奇宝宝**：粉色系、大眼睛、上扬眉毛、问号装饰
3. **思考者**：紫色系、眼镜、沉思表情
4. **小助手**：绿色系、月牙眼、大笑、爱心徽章
5. **记录员**：橙色系、专注表情
6. **用户**：灰色系、中性设计、简洁风格

### 技术特点
- SVG 格式，文件小巧 (~1.5KB)
- 支持深色/浅色模式自适应
- 矢量无限缩放不失真
- 内联样式，无需外部依赖

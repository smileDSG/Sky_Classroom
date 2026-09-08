/**
 * 头像生成脚本 (JavaScript 版本)
 * ================================
 *
 * 运行: node scripts/generate-avatars.js
 *
 * 生成天空课堂风格的新头像集
 */

const fs = require('fs');
const path = require('path');

// 头像配置
const AVATARS_CONFIG = [
  {
    id: 'sky-teacher',
    name: '林老师',
    role: 'teacher',
    filename: 'teacher-new.svg',
    colors: { primary: '#0ea5e9', secondary: '#0284c7', bg: '#f0f9ff' },
    features: { glasses: true, cloud: true, smile: 'gentle' },
  },
  {
    id: 'sky-curious',
    name: '好奇宝宝',
    role: 'student',
    filename: 'curious-new.svg',
    colors: { primary: '#f472b6', secondary: '#ec4899', bg: '#fef3c7' },
    features: { bigEyes: true, question: true },
  },
  {
    id: 'sky-thinker',
    name: '思考者',
    role: 'student',
    filename: 'thinker-new.svg',
    colors: { primary: '#8b5cf6', secondary: '#7c3aed', bg: '#ede9fe' },
    features: { glasses: true, thoughtful: true },
  },
  {
    id: 'sky-helper',
    name: '小助手',
    role: 'assistant',
    filename: 'helper-new.svg',
    colors: { primary: '#10b981', secondary: '#059669', bg: '#d1fae5' },
    features: { heart: true, friendly: true },
  },
  {
    id: 'sky-notetaker',
    name: '记录员',
    role: 'student',
    filename: 'notetaker-new.svg',
    colors: { primary: '#f59e0b', secondary: '#d97706', bg: '#fef3c7' },
    features: { notebook: true, focused: true },
  },
  {
    id: 'sky-user',
    name: '我',
    role: 'user',
    filename: 'user-new.svg',
    colors: { primary: '#64748b', secondary: '#475569', bg: '#f1f5f9' },
    features: { neutral: true },
  },
  {
    id: 'sky-student-1',
    name: '学霸小明',
    role: 'student',
    filename: 'student-1.svg',
    colors: { primary: '#3b82f6', secondary: '#2563eb', bg: '#dbeafe' },
    features: { glasses: true, confident: true },
  },
  {
    id: 'sky-student-2',
    name: '活泼小红',
    role: 'student',
    filename: 'student-2.svg',
    colors: { primary: '#ef4444', secondary: '#dc2626', bg: '#fee2e2' },
    features: { bow: true, energetic: true },
  },
];

// SVG 模板生成函数
function generateTeacherSVG(config) {
  const { colors, features } = config;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280" fill="none">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="280" y2="280">
      <stop offset="0%" stop-color="${colors.bg}"/>
      <stop offset="100%" stop-color="${colors.primary}" stop-opacity="0.2"/>
    </linearGradient>
    <linearGradient id="clothesGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${colors.primary}"/>
      <stop offset="100%" stop-color="${colors.secondary}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="${colors.primary}" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- 背景 -->
  <rect width="280" height="280" rx="140" fill="url(#bgGrad)"/>

  <!-- 装饰云朵 -->
  <g opacity="0.3">
    <circle cx="50" cy="60" r="15" fill="${colors.primary}"/>
    <circle cx="70" cy="55" r="20" fill="${colors.primary}"/>
    <circle cx="90" cy="60" r="15" fill="${colors.primary}"/>
  </g>

  <!-- 身体 -->
  <path d="M70 195c0-28 28-48 70-48s70 20 70 48v55H70v-55z" fill="url(#clothesGrad)" filter="url(#shadow)"/>
  <path d="M95 147h90v103H95z" fill="${colors.secondary}"/>

  <!-- 领口 -->
  <path d="M125 147l15 15 15-15" fill="white" opacity="0.9"/>

  <!-- 脖子 -->
  <rect x="128" y="130" width="24" height="22" fill="#ffdbb4"/>

  <!-- 头 -->
  <ellipse cx="140" cy="102" rx="44" ry="50" fill="#ffdbb4"/>

  <!-- 头发 -->
  <path d="M96 85c0-24 20-38 44-38s44 14 44 38c0 6-2 12-5 16-2-12-10-18-22-18s-20 6-22 18c-3-4-5-10-5-16z" fill="#4a3728"/>
  <path d="M96 85c5-8 25-12 44-12s39 4 44 12v10c-5-5-25-10-44-10s-39 5-44 10z" fill="#5d4a35"/>

  <!-- 眼镜 -->
  <g stroke="#374151" stroke-width="2.5" fill="none">
    <circle cx="122" cy="95" r="12"/>
    <circle cx="158" cy="95" r="12"/>
    <line x1="134" y1="95" x2="146" y2="95"/>
  </g>

  <!-- 眼睛 -->
  <circle cx="122" cy="95" r="4" fill="#1f2937"/>
  <circle cx="158" cy="95" r="4" fill="#1f2937"/>

  <!-- 眉毛 -->
  <path d="M115 85q7-3 14 0" stroke="#4a3728" stroke-width="2" fill="none"/>
  <path d="M151 85q7-3 14 0" stroke="#4a3728" stroke-width="2" fill="none"/>

  <!-- 温和微笑 -->
  <path d="M130 120q10 6 20 0" stroke="#d97706" stroke-width="2.5" fill="none" stroke-linecap="round"/>

  <!-- 云朵徽章 -->
  <g transform="translate(200, 55)">
    <circle r="22" fill="white" filter="url(#shadow)"/>
    <path d="M-8 0c0-5 4-8 8-8 4 0 7 3 8 6 3 0 6 3 6 6s-3 6-6 6h-16c-3 0-6-3-6-6s3-6 6-6z" fill="${colors.primary}"/>
  </g>
</svg>`;
}

function generateStudentSVG(config) {
  const { colors, features } = config;
  const id = config.id.replace(/-/g, '');
  const hasQuestion = features.question
    ? `
    <text x="215" y="65" font-family="Arial, sans-serif" font-size="42" fill="${colors.primary}" font-weight="bold">?</text>
  `
    : '';
  const hasBow = features.bow
    ? `
    <g transform="translate(140, 50)">
      <path d="M-15 0c-5 0-10 5-10 10s5 10 10 10c5 0 8-3 10-5-2-5-5-15-10-15z" fill="#ef4444"/>
      <path d="M15 0c5 0 10 5 10 10s-5 10-10 10c-5 0-8-3-10-5 2-5 5-15 10-15z" fill="#ef4444"/>
      <circle r="5" fill="#dc2626"/>
    </g>
  `
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280" fill="none">
  <defs>
    <linearGradient id="bgGrad-${id}" x1="0" y1="0" x2="280" y2="280">
      <stop offset="0%" stop-color="${colors.bg}"/>
      <stop offset="100%" stop-color="${colors.primary}" stop-opacity="0.15"/>
    </linearGradient>
    <filter id="shadow-${id}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="${colors.primary}" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- 背景 -->
  <rect width="280" height="280" rx="140" fill="url(#bgGrad-${id})"/>

  <!-- 身体 -->
  <path d="M75 198c0-26 26-46 65-46s65 20 65 46v52H75v-52z" fill="${colors.primary}" filter="url(#shadow-${id})"/>
  <path d="M105 152h70v98H105z" fill="${colors.secondary}"/>

  <!-- 脖子 -->
  <rect x="128" y="135" width="24" height="22" fill="#ffdbb4"/>

  <!-- 头 -->
  <ellipse cx="140" cy="105" rx="42" ry="48" fill="#ffdbb4"/>

  <!-- 头发 -->
  <path d="M98 88c0-22 19-35 42-35s42 13 42 35c0 8-3 15-8 20-3-12-12-18-24-18s-21 6-24 18c-5-5-8-12-8-20z" fill="#1f2937"/>

  ${hasBow}

  ${
    features.bigEyes
      ? `
  <!-- 大眼睛 -->
  <circle cx="124" cy="98" r="10" fill="white"/>
  <circle cx="124" cy="98" r="5" fill="#1f2937"/>
  <circle cx="156" cy="98" r="10" fill="white"/>
  <circle cx="156" cy="98" r="5" fill="#1f2937"/>
  <circle cx="126" cy="96" r="2" fill="white"/>
  <circle cx="158" cy="96" r="2" fill="white"/>
  `
      : `
  <!-- 眼睛 -->
  <circle cx="124" cy="98" r="4" fill="#1f2937"/>
  <circle cx="156" cy="98" r="4" fill="#1f2937"/>
  `
  }

  <!-- 眉毛 - 好奇上扬 -->
  <path d="M115 85q9-8 18-3" stroke="#1f2937" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M147 82q9-5 18 3" stroke="#1f2937" stroke-width="2.5" fill="none" stroke-linecap="round"/>

  <!-- 小嘴 -->
  <circle cx="140" cy="122" r="4" fill="#f472b6"/>

  ${hasQuestion}
</svg>`;
}

function generateHelperSVG(config) {
  const { colors } = config;
  const id = config.id.replace(/-/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280" fill="none">
  <defs>
    <linearGradient id="bgGrad-${id}" x1="0" y1="0" x2="280" y2="280">
      <stop offset="0%" stop-color="${colors.bg}"/>
      <stop offset="100%" stop-color="${colors.primary}" stop-opacity="0.2"/>
    </linearGradient>
    <filter id="shadow-${id}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="${colors.primary}" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- 背景 -->
  <rect width="280" height="280" rx="140" fill="url(#bgGrad-${id})"/>

  <!-- 身体 -->
  <path d="M70 195c0-28 28-48 70-48s70 20 70 48v55H70v-55z" fill="${colors.primary}" filter="url(#shadow-${id})"/>
  <path d="M100 147h80v103H100z" fill="${colors.secondary}"/>

  <!-- 领口 -->
  <path d="M130 147l10 12 10-12" fill="white" opacity="0.9"/>

  <!-- 脖子 -->
  <rect x="128" y="130" width="24" height="22" fill="#ffdbb4"/>

  <!-- 头 -->
  <ellipse cx="140" cy="102" rx="44" ry="50" fill="#ffdbb4"/>

  <!-- 头发 -->
  <path d="M96 85c0-24 20-38 44-38s44 14 44 38c0 6-2 12-5 16-2-12-10-18-22-18s-20 6-22 18c-3-4-5-10-5-16z" fill="#7c2d12"/>

  <!-- 友好眼睛 -->
  <path d="M115 95c0 6 5 10 10 10s10-4 10-10" fill="none" stroke="#1f2937" stroke-width="3" stroke-linecap="round"/>
  <path d="M155 95c0 6 5 10 10 10s10-4 10-10" fill="none" stroke="#1f2937" stroke-width="3" stroke-linecap="round"/>

  <!-- 大笑 -->
  <path d="M125 120c7 10 23 10 30 0" fill="none" stroke="#1f2937" stroke-width="3" stroke-linecap="round"/>

  <!-- 爱心徽章 -->
  <g transform="translate(200, 60)">
    <circle r="22" fill="white" filter="url(#shadow-${id})"/>
    <path d="M0 5c-7 0-12 5-12 12 0 10 12 18 12 18s12-8 12-18c0-7-5-12-12-12z" fill="#f472b6"/>
  </g>
</svg>`;
}

function generateUserSVG(config) {
  const { colors } = config;
  const id = config.id.replace(/-/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280" fill="none">
  <defs>
    <linearGradient id="bgGrad-${id}" x1="0" y1="0" x2="280" y2="280">
      <stop offset="0%" stop-color="${colors.bg}"/>
      <stop offset="100%" stop-color="${colors.secondary}" stop-opacity="0.2"/>
    </linearGradient>
  </defs>

  <!-- 背景 -->
  <rect width="280" height="280" rx="140" fill="url(#bgGrad-${id})"/>

  <!-- 身体 -->
  <path d="M80 198c0-26 27-46 60-46s60 20 60 46v52H80v-52z" fill="${colors.primary}"/>
  <path d="M110 152h60v98H110z" fill="${colors.secondary}"/>

  <!-- 脖子 -->
  <rect x="130" y="135" width="20" height="22" fill="#e2c4a6"/>

  <!-- 头 -->
  <ellipse cx="140" cy="108" rx="40" ry="46" fill="#e2c4a6"/>

  <!-- 中性短发 -->
  <ellipse cx="140" cy="75" rx="35" ry="18" fill="${colors.secondary}"/>
  <path d="M105 75c0-15 15-25 35-25s35 10 35 25v5c-5-10-20-15-35-15s-30 5-35 15z" fill="${colors.secondary}"/>

  <!-- 眼睛 -->
  <circle cx="128" cy="105" r="4" fill="#374151"/>
  <circle cx="152" cy="105" r="4" fill="#374151"/>

  <!-- 中性嘴 -->
  <line x1="132" y1="125" x2="148" y2="125" stroke="#374151" stroke-width="2" stroke-linecap="round"/>
</svg>`;
}

// 主生成函数
function generateAvatarSVG(config) {
  switch (config.role) {
    case 'teacher':
      return generateTeacherSVG(config);
    case 'assistant':
      return generateHelperSVG(config);
    case 'user':
      return generateUserSVG(config);
    default:
      return generateStudentSVG(config);
  }
}

// 执行生成
function main() {
  const avatarsDir = path.join(process.cwd(), 'public', 'avatars');

  // 确保目录存在
  if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
  }

  console.log('🎨 生成天空课堂头像集...\n');
  console.log('设计风格：现代扁平化 · 天空主题 · 渐变配色\n');

  let successCount = 0;
  let failCount = 0;

  for (const config of AVATARS_CONFIG) {
    try {
      const svg = generateAvatarSVG(config);
      const filepath = path.join(avatarsDir, config.filename);
      fs.writeFileSync(filepath, svg, 'utf-8');
      console.log(`✅ ${config.name.padEnd(8)} → ${config.filename}`);
      successCount++;
    } catch (error) {
      console.error(`❌ ${config.name}:`, error.message);
      failCount++;
    }
  }

  console.log(`\n✨ 完成！生成 ${successCount}/${AVATARS_CONFIG.length} 个头像`);
  console.log(`📁 输出目录: ${avatarsDir}\n`);

  // 打印使用说明
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('使用说明');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('在项目中引用新头像:\n');

  AVATARS_CONFIG.forEach((config) => {
    console.log(`  ${config.name.padEnd(8)} /avatars/${config.filename}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('下一步');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. 更新 lib/constants/agent-defaults.ts');
  console.log('2. 将新头像路径加入 AGENT_DEFAULT_AVATARS 数组');
  console.log('3. 刷新页面查看效果\n');
}

main();

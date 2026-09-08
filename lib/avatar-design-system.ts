/**
 * 天空课堂头像设计方案
 * ===================
 *
 * 设计理念：
 * - 采用现代扁平化风格，与天空课堂的云端、天空主题呼应
 * - 使用渐变天空色系（天蓝、云朵白、晨曦粉）
 * - 角色设定：老师、学生、助手、好奇宝宝、思考者、记录员
 *
 * 配色方案：
 * - 主色：天蓝色 #0ea5e9 (sky-500)
 * - 辅色：云朵白 #f0f9ff (sky-50)
 * - 点缀：晨曦粉 #f472b6 (pink-400)、阳光金 #fbbf24 (amber-400)
 * - 深色：夜空蓝 #1e293b (slate-800)
 */

export const AVATAR_DESIGN_SYSTEM = {
  // 颜色系统
  colors: {
    primary: '#0ea5e9', // 天蓝
    secondary: '#38bdf8', // 浅天蓝
    accent: '#f472b6', // 粉色点缀
    highlight: '#fbbf24', // 金色阳光
    dark: '#1e293b', // 深蓝
    light: '#f0f9ff', // 极浅蓝白
    white: '#ffffff',
  },

  // 角色定义
  characters: [
    {
      id: 'teacher',
      name: '林老师',
      role: 'teacher',
      description: '温和亲切的云端导师',
      colors: ['#0ea5e9', '#0284c7'],
      features: ['眼镜', '微笑', '云朵发饰'],
    },
    {
      id: 'student-curious',
      name: '好奇宝宝',
      role: 'student',
      description: '充满好奇心的提问者',
      colors: ['#f472b6', '#ec4899'],
      features: ['大眼睛', '问号发饰', '活泼表情'],
    },
    {
      id: 'student-thinker',
      name: '思考者',
      role: 'student',
      description: '深思熟虑的学习者',
      colors: ['#8b5cf6', '#7c3aed'],
      features: ['沉思表情', '眼镜', '书本'],
    },
    {
      id: 'student-helper',
      name: '小助手',
      role: 'assistant',
      description: '热心助人的小伙伴',
      colors: ['#10b981', '#059669'],
      features: ['友善微笑', '帮助手势'],
    },
    {
      id: 'student-notetaker',
      name: '记录员',
      role: 'student',
      description: '认真记录的学霸',
      colors: ['#f59e0b', '#d97706'],
      features: ['专注表情', '笔记本', '眼镜'],
    },
    {
      id: 'user',
      name: '我',
      role: 'user',
      description: '当前用户',
      colors: ['#64748b', '#475569'],
      features: ['中性形象', '可自定义'],
    },
  ],

  // SVG 生成配置
  svgConfig: {
    size: 280,
    viewBox: '0 0 280 280',
    shapeRendering: 'geometricPrecision',
  },
};

/**
 * 生成天空课堂风格的 SVG 头像
 */
export function generateSkyAvatar(
  type: 'teacher' | 'student' | 'assistant' | 'user',
  options?: {
    primaryColor?: string;
    secondaryColor?: string;
    gender?: 'male' | 'female' | 'neutral';
  },
): string {
  const colors = AVATAR_DESIGN_SYSTEM.colors;
  const opts = {
    primaryColor: options?.primaryColor || colors.primary,
    secondaryColor: options?.secondaryColor || colors.secondary,
    gender: options?.gender || 'neutral',
  };

  // 根据不同角色返回不同的 SVG
  const avatars: Record<string, string> = {
    teacher: generateTeacherAvatar(opts),
    student: generateStudentAvatar(opts),
    assistant: generateAssistantAvatar(opts),
    user: generateUserAvatar(opts),
  };

  return avatars[type] || avatars.user;
}

function generateTeacherAvatar(opts: { primaryColor: string; secondaryColor: string }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280" fill="none">
    <!-- Background -->
    <rect width="280" height="280" fill="#f0f9ff" rx="140"/>
    <circle cx="140" cy="140" r="120" fill="url(#teacherGrad)" opacity="0.3"/>

    <!-- Body -->
    <path d="M70 200c0-30 30-50 70-50s70 20 70 50v60H70v-60z" fill="#0ea5e9"/>
    <path d="M100 150h80v110H100z" fill="#0284c7"/>

    <!-- Neck -->
    <rect x="125" y="130" width="30" height="30" fill="#ffdbb4"/>

    <!-- Head -->
    <ellipse cx="140" cy="100" rx="45" ry="50" fill="#ffdbb4"/>

    <!-- Hair -->
    <path d="M95 85c0-25 20-40 45-40s45 15 45 40c0 15-10 25-20 30-5-15-15-20-25-20s-20 5-25 20c-10-5-20-15-20-30z" fill="#4a3728"/>

    <!-- Glasses -->
    <circle cx="122" cy="95" r="10" fill="none" stroke="#374151" stroke-width="2"/>
    <circle cx="158" cy="95" r="10" fill="none" stroke="#374151" stroke-width="2"/>
    <line x1="132" y1="95" x2="148" y2="95" stroke="#374151" stroke-width="2"/>

    <!-- Eyes -->
    <circle cx="122" cy="95" r="3" fill="#1f2937"/>
    <circle cx="158" cy="95" r="3" fill="#1f2937"/>

    <!-- Smile -->
    <path d="M130 115q10 8 20 0" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round"/>

    <!-- Cloud badge -->
    <circle cx="200" cy="60" r="20" fill="#ffffff" opacity="0.9"/>
    <path d="M190 60c0-5 4-8 8-8 4 0 7 3 8 6 3 0 6 3 6 6s-3 6-6 6h-16c-3 0-6-3-6-6s3-6 6-6z" fill="#0ea5e9"/>

    <defs>
      <linearGradient id="teacherGrad" x1="0" y1="0" x2="280" y2="280">
        <stop stop-color="#0ea5e9"/>
        <stop offset="1" stop-color="#38bdf8"/>
      </linearGradient>
    </defs>
  </svg>`;
}

function generateStudentAvatar(opts: { primaryColor: string; secondaryColor: string }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280" fill="none">
    <!-- Background -->
    <rect width="280" height="280" fill="#fef3c7" rx="140"/>
    <circle cx="140" cy="140" r="120" fill="url(#studentGrad)" opacity="0.2"/>

    <!-- Body -->
    <path d="M75 200c0-25 25-45 65-45s65 20 65 45v60H75v-60z" fill="#f59e0b"/>
    <path d="M105 155h70v105H105z" fill="#d97706"/>

    <!-- Neck -->
    <rect x="128" y="135" width="24" height="25" fill="#ffdbb4"/>

    <!-- Head -->
    <ellipse cx="140" cy="105" rx="42" ry="48" fill="#ffdbb4"/>

    <!-- Hair -->
    <path d="M98 90c0-22 19-35 42-35s42 13 42 35c0 8-3 15-8 20-3-12-12-18-24-18s-21 6-24 18c-5-5-8-12-8-20z" fill="#1f2937"/>

    <!-- Big curious eyes -->
    <circle cx="125" cy="100" r="8" fill="#ffffff"/>
    <circle cx="125" cy="100" r="4" fill="#1f2937"/>
    <circle cx="155" cy="100" r="8" fill="#ffffff"/>
    <circle cx="155" cy="100" r="4" fill="#1f2937"/>

    <!-- Wonder expression -->
    <circle cx="140" cy="125" r="4" fill="#f472b6"/>

    <!-- Question mark -->
    <text x="210" y="70" font-family="Arial" font-size="40" fill="#f472b6" font-weight="bold">?</text>

    <defs>
      <linearGradient id="studentGrad" x1="0" y1="0" x2="280" y2="280">
        <stop stop-color="#fbbf24"/>
        <stop offset="1" stop-color="#f59e0b"/>
      </linearGradient>
    </defs>
  </svg>`;
}

function generateAssistantAvatar(opts: { primaryColor: string; secondaryColor: string }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280" fill="none">
    <!-- Background -->
    <rect width="280" height="280" fill="#d1fae5" rx="140"/>
    <circle cx="140" cy="140" r="120" fill="url(#assistantGrad)" opacity="0.3"/>

    <!-- Body -->
    <path d="M70 200c0-28 28-48 70-48s70 20 70 48v60H70v-60z" fill="#10b981"/>
    <path d="M100 152h80v108H100z" fill="#059669"/>

    <!-- Neck -->
    <rect x="126" y="132" width="28" height="28" fill="#ffdbb4"/>

    <!-- Head -->
    <ellipse cx="140" cy="102" rx="44" ry="50" fill="#ffdbb4"/>

    <!-- Hair -->
    <path d="M96 85c0-24 20-38 44-38s44 14 44 38c0 6-2 12-5 16-2-10-10-16-20-16s-18 6-20 16c-3-4-5-10-5-16z" fill="#7c2d12"/>

    <!-- Friendly eyes -->
    <path d="M118 98c0 5 4 8 8 8s8-3 8-8" fill="none" stroke="#1f2937" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M154 98c0 5 4 8 8 8s8-3 8-8" fill="none" stroke="#1f2937" stroke-width="2.5" stroke-linecap="round"/>

    <!-- Big smile -->
    <path d="M125 120c5 10 25 10 30 0" fill="none" stroke="#1f2937" stroke-width="2.5" stroke-linecap="round"/>

    <!-- Heart badge -->
    <path d="M200 55c-8 0-15 6-15 14 0 12 15 22 15 22s15-10 15-22c0-8-7-14-15-14z" fill="#f472b6"/>

    <defs>
      <linearGradient id="assistantGrad" x1="0" y1="0" x2="280" y2="280">
        <stop stop-color="#34d399"/>
        <stop offset="1" stop-color="#10b981"/>
      </linearGradient>
    </defs>
  </svg>`;
}

function generateUserAvatar(opts: { primaryColor: string; secondaryColor: string }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280" fill="none">
    <!-- Background -->
    <rect width="280" height="280" fill="#f1f5f9" rx="140"/>
    <circle cx="140" cy="140" r="120" fill="url(#userGrad)" opacity="0.2"/>

    <!-- Body -->
    <path d="M80 200c0-26 27-46 60-46s60 20 60 46v60H80v-60z" fill="#64748b"/>
    <path d="M110 154h60v106H110z" fill="#475569"/>

    <!-- Neck -->
    <rect x="130" y="136" width="20" height="24" fill="#e2c4a6"/>

    <!-- Head -->
    <ellipse cx="140" cy="108" rx="40" ry="46" fill="#e2c4a6"/>

    <!-- Simple hair -->
    <ellipse cx="140" cy="75" rx="35" ry="20" fill="#475569"/>

    <!-- Neutral eyes -->
    <circle cx="125" cy="105" r="4" fill="#374151"/>
    <circle cx="155" cy="105" r="4" fill="#374151"/>

    <!-- Neutral mouth -->
    <line x1="132" y1="125" x2="148" y2="125" stroke="#374151" stroke-width="2" stroke-linecap="round"/>

    <defs>
      <linearGradient id="userGrad" x1="0" y1="0" x2="280" y2="280">
        <stop stop-color="#94a3b8"/>
        <stop offset="1" stop-color="#64748b"/>
      </linearGradient>
    </defs>
  </svg>`;
}

// 导出所有头像生成函数
export const AvatarGenerators = {
  teacher: generateTeacherAvatar,
  student: generateStudentAvatar,
  assistant: generateAssistantAvatar,
  user: generateUserAvatar,
};

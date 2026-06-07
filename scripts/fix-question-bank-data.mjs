/**
 * Fix question bank data:
 * 1. Delete choice/judge questions with null/empty options (dirty data)
 * 2. Insert properly formatted test questions with complete options
 */

import mysql from 'mysql2/promise';
import crypto from 'crypto';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'sky_classroom',
});

function hashProblemText(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 32);
}

async function main() {
  // Ensure table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_bank (
      id               VARCHAR(64)  PRIMARY KEY,
      subject          VARCHAR(64)  NOT NULL DEFAULT '',
      grade            VARCHAR(32)  NOT NULL DEFAULT '',
      difficulty       VARCHAR(16)  NOT NULL DEFAULT 'medium',
      question_type    VARCHAR(16)  NOT NULL DEFAULT 'solve',
      content          TEXT         NOT NULL,
      answer           TEXT         NOT NULL,
      explanation      TEXT         NOT NULL,
      knowledge_points JSON         NOT NULL DEFAULT (JSON_ARRAY()),
      image            TEXT,
      options          JSON,
      source           VARCHAR(255),
      tags             JSON         NOT NULL DEFAULT (JSON_ARRAY()),
      problem_hash     VARCHAR(64)  NOT NULL,
      verified         BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX uq_problem_hash (problem_hash),
      INDEX idx_subject    (subject),
      INDEX idx_difficulty (difficulty),
      INDEX idx_grade      (grade),
      INDEX idx_type       (question_type),
      INDEX idx_verified   (verified),
      FULLTEXT INDEX ft_content (content, explanation) WITH PARSER ngram
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── Step 1: Clean dirty data ─────────────────────────────────────────
  const [cleanRes] = await pool.query(
    `DELETE FROM question_bank
     WHERE question_type IN ('choice', 'judge')
       AND (options IS NULL OR JSON_LENGTH(options) = 0)`
  );
  console.log(`Cleaned dirty data: ${cleanRes.affectedRows ?? 0} rows deleted`);

  const [cleanRes2] = await pool.query(
    `DELETE FROM question_bank
     WHERE question_type NOT IN ('choice', 'judge')
       AND options IS NOT NULL`
  );
  console.log(`Cleaned inconsistent data: ${cleanRes2.affectedRows ?? 0} rows deleted`);

  // ── Step 2: Insert well-formed test data ─────────────────────────────
  const now = new Date();
  const ts = Date.now();

  const testQuestions = [
    {
      id: `qb_test_${ts}_1`,
      subject: '历史',
      grade: '高二',
      difficulty: 'medium',
      questionType: 'choice',
      content: '下列关于辛亥革命历史意义的叙述，不正确的是',
      answer: 'B',
      explanation: '辛亥革命结束的是封建君主专制制度，而非封建制度。封建制度的彻底废除是在新中国成立后的土地改革完成之后。',
      knowledgePoints: ['辛亥革命', '中国近代史', '封建制度'],
      options: ['推翻了清王朝的统治', '结束了中国两千多年的封建制度', '使民主共和观念深入人心', '为民族资本主义发展创造了条件'],
      tags: ['测试数据', '高考真题'],
      verified: true,
    },
    {
      id: `qb_test_${ts}_2`,
      subject: '数学',
      grade: '高一',
      difficulty: 'easy',
      questionType: 'choice',
      content: '函数 f(x)=\\sqrt{x-1} 的定义域是',
      answer: 'B',
      explanation: '被开方数必须非负，即 x-1 >= 0，解得 x >= 1。',
      knowledgePoints: ['函数定义域', '根式函数'],
      options: ['(-\\infty,1]', '[1,+\\infty)', '(-\\infty,1)', '(1,+\\infty)'],
      tags: ['测试数据', '基础题'],
      verified: true,
    },
    {
      id: `qb_test_${ts}_3`,
      subject: '物理',
      grade: '高一',
      difficulty: 'medium',
      questionType: 'choice',
      content: '一物体做匀加速直线运动，初速度为 2 m/s，加速度为 1 m/s\\(^2\\)，则第 3 s 内的位移为',
      answer: 'C',
      explanation: '前 3 s 位移 s_3 = v_0t + 1/2 at^2 = 6 + 4.5 = 10.5 m；前 2 s 位移 s_2 = 4 + 2 = 6 m；第 3 s 内位移 = 10.5 - 6 = 4.5 m。',
      knowledgePoints: ['匀变速直线运动', '位移公式'],
      options: ['3 m', '3.5 m', '4.5 m', '5 m'],
      tags: ['测试数据', '经典例题'],
      verified: true,
    },
    {
      id: `qb_test_${ts}_4`,
      subject: '化学',
      grade: '高二',
      difficulty: 'hard',
      questionType: 'choice',
      content: '下列离子方程式书写正确的是',
      answer: 'D',
      explanation: 'A 项中 CaCO3 难溶不应拆；B 项电荷不守恒；C 项漏写 H2O 的生成；D 项 Cl2 与 NaOH 反应生成 NaCl、NaClO 和 H2O，正确。',
      knowledgePoints: ['离子方程式', '氧化还原反应'],
      options: [
        'CaCO3 + 2H+ = Ca2+ + H2O + CO2\\uparrow',
        '2Fe3+ + Cu = 2Fe2+ + Cu2+',
        'OH- + H+ = H2O',
        'Cl2 + 2OH- = Cl- + ClO- + H2O',
      ],
      tags: ['测试数据', '易错题'],
      verified: true,
    },
    {
      id: `qb_test_${ts}_5`,
      subject: '英语',
      grade: '高一',
      difficulty: 'easy',
      questionType: 'choice',
      content: "— How was your trip to London, Jane?\n— _______. I saw many interesting things there.",
      answer: 'A',
      explanation: '"It was great" 表示"很棒"，与后文"看到很多有趣的事物"语义连贯。',
      knowledgePoints: ['情景交际', '日常对话'],
      options: ['It was great', 'It is rainy', 'I am fine', 'Not at all'],
      tags: ['测试数据', '情景交际'],
      verified: true,
    },
    {
      id: `qb_test_${ts}_6`,
      subject: '数学',
      grade: '高二',
      difficulty: 'medium',
      questionType: 'solve',
      content: '已知函数 f(x) = x^3 - 3x^2 + 2，求函数的极值。',
      answer: 'f(x) 在 x=0 处取得极大值 2，在 x=2 处取得极小值 -2。',
      explanation: "求导得 f'(x)=3x^2-6x=3x(x-2)。令 f'(x)=0 得 x=0 或 x=2。当 x<0 时 f'(x)>0；当 0<x<2 时 f'(x)<0；当 x>2 时 f'(x)>0。故 x=0 为极大值点，f(0)=2；x=2 为极小值点，f(2)=-2。",
      knowledgePoints: ['导数', '极值', '函数分析'],
      options: null,
      tags: ['测试数据', '解答题'],
      verified: true,
    },
    {
      id: `qb_test_${ts}_7`,
      subject: '语文',
      grade: '高二',
      difficulty: 'hard',
      questionType: 'fill',
      content: '《红楼梦》中"机关算尽太聪明，反算了卿卿性命"描写的是______。',
      answer: '王熙凤',
      explanation: '此判词出自《红楼梦》第五回，描写王熙凤精明强干却最终悲剧收场的一生。',
      knowledgePoints: ['红楼梦', '名著阅读', '古典文学'],
      options: null,
      tags: ['测试数据', '名著填空'],
      verified: true,
    },
    {
      id: `qb_test_${ts}_8`,
      subject: '生物',
      grade: '高一',
      difficulty: 'easy',
      questionType: 'judge',
      content: '光合作用只能在有叶绿体的细胞中进行。',
      answer: '错误',
      explanation: '蓝藻等原核生物没有叶绿体，但含有叶绿素和藻蓝素，也能进行光合作用。',
      knowledgePoints: ['光合作用', '细胞结构'],
      options: ['正确', '错误'],
      tags: ['测试数据', '判断题'],
      verified: true,
    },
  ];

  let inserted = 0;
  let skipped = 0;

  for (const q of testQuestions) {
    const problemHash = hashProblemText(q.content);

    const [existing] = await pool.query(
      'SELECT id FROM question_bank WHERE problem_hash = ? LIMIT 1',
      [problemHash]
    );
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await pool.query(
      `INSERT INTO question_bank
        (id, subject, grade, difficulty, question_type, content, answer,
         explanation, knowledge_points, image, options, source, tags,
         problem_hash, verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        q.id,
        q.subject,
        q.grade,
        q.difficulty,
        q.questionType,
        q.content,
        q.answer,
        q.explanation,
        JSON.stringify(q.knowledgePoints),
        null,
        q.options ? JSON.stringify(q.options) : null,
        null,
        JSON.stringify(q.tags),
        problemHash,
        q.verified,
        now,
        now,
      ]
    );
    inserted++;
    console.log(`Inserted: ${q.subject} — ${q.content.slice(0, 30)}...`);
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped (duplicates): ${skipped}`);
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});

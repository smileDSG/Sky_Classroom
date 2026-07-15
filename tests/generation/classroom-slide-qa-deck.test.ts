import { describe, expect, it } from 'vitest';

import { auditClassroomSlideContents } from '@/lib/generation/scene-content/classroom-slide-qa';
import type { GeneratedSlideContent, SceneOutline } from '@/lib/types/generation';
import type { PPTElement } from '@/lib/types/slides';

const zh = {
  title: '\u6570\u636e\u7ed3\u6784\u5bf9\u7167',
  subtitle:
    '\u4ece\u573a\u666f\u3001\u64cd\u4f5c\u3001\u98ce\u9669\u548c\u603b\u7ed3\u56db\u4e2a\u89d2\u5ea6\u8bb2\u89e3',
  scenario:
    '\u9002\u7528\u573a\u666f\uff1a\u6839\u636e\u4e1a\u52a1\u8bbf\u95ee\u6a21\u5f0f\u9009\u62e9\u5408\u9002\u7684\u5b58\u50a8\u7ed3\u6784\u3002',
  command:
    '\u5173\u952e\u64cd\u4f5c\uff1a\u628a\u8bfb\u5199\u3001\u6392\u5e8f\u3001\u53bb\u91cd\u548c\u5c40\u90e8\u66f4\u65b0\u5206\u5f00\u5224\u65ad\u3002',
  caution:
    '\u6613\u9519\u63d0\u9192\uff1a\u4e0d\u8981\u53ea\u770b\u540d\u79f0\uff0c\u8981\u770b\u6570\u636e\u5f62\u6001\u548c\u7ed3\u679c\u9700\u6c42\u3002',
  summary:
    '\u8bfe\u5802\u5c0f\u7ed3\uff1a\u5148\u5224\u65ad\u6570\u636e\u50cf\u4ec0\u4e48\uff0c\u518d\u5224\u65ad\u9700\u8981\u600e\u4e48\u8bbf\u95ee\u3002',
};

function outline(order: number): SceneOutline {
  return {
    id: `scene_${order}`,
    type: 'slide',
    title: `${zh.title} ${order}`,
    description: zh.subtitle,
    keyPoints: [zh.scenario, zh.command, zh.caution, zh.summary],
    order,
  };
}

function text(
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
  value: string,
  fontSize = 22,
): PPTElement {
  return {
    id,
    type: 'text',
    left,
    top,
    width,
    height,
    rotate: 0,
    defaultFontName: 'Microsoft YaHei',
    defaultColor: '#1e293b',
    content: `<p style="font-size:${fontSize}px;line-height:1.25;">${value}</p>`,
  } as PPTElement;
}

function shape(
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
  fill = '#eaf4ff',
): PPTElement {
  return {
    id,
    type: 'shape',
    left,
    top,
    width,
    height,
    rotate: 0,
    fill,
    path: 'M0 0 L1 0 L1 1 L0 1 Z',
    viewBox: '0 0 1 1',
    fixedRatio: false,
  } as PPTElement;
}

function table(id: string): PPTElement {
  return {
    id,
    type: 'table',
    left: 82,
    top: 160,
    width: 836,
    height: 132,
    rotate: 0,
    outline: { color: '#cfe0f5', width: 1, style: 'solid' },
    theme: {
      color: '#2563eb',
      rowHeader: true,
      rowFooter: false,
      colHeader: false,
      colFooter: false,
    },
    colWidths: [0.28, 0.36, 0.36],
    cellMinHeight: 42,
    data: [
      ['判断项', '课堂落点', '检查问题'],
      ['数据形态', '对象/列表/集合', '是否需要顺序或去重'],
      ['访问方式', '读写/排序/局部更新', '是否需要范围查询'],
    ].map((row, rowIndex) =>
      row.map((cell, cellIndex) => ({
        id: `${id}_${rowIndex}_${cellIndex}`,
        text: cell,
        colspan: 1,
        rowspan: 1,
        style: {
          bold: rowIndex === 0 || cellIndex === 0,
          color: '#1e293b',
          backcolor: rowIndex === 0 ? '#eaf4ff' : '#ffffff',
          fontsize: rowIndex === 0 ? '18' : '17',
          fontname: 'Microsoft YaHei',
          align: 'left',
        },
      })),
    ),
  } as PPTElement;
}

function repeatedLayoutContent(order: number): GeneratedSlideContent {
  return {
    background: { type: 'solid', color: '#ffffff' },
    remark: `layout ${order}`,
    elements: [
      text(`title_${order}`, 72, 54, 856, 58, `${zh.title} ${order}`, 32),
      text(`subtitle_${order}`, 72, 118, 856, 34, zh.subtitle, 20),
      table(`table_${order}`),
      shape(`card_a_${order}`, 82, 326, 390, 78),
      shape(`card_b_${order}`, 528, 326, 390, 78),
      shape(`card_c_${order}`, 82, 426, 390, 58, '#f8fbff'),
      shape(`card_d_${order}`, 528, 426, 390, 58, '#f8fbff'),
      text(`body_a_${order}`, 104, 342, 346, 42, `${zh.scenario} ${order}`, 20),
      text(`body_b_${order}`, 550, 342, 346, 42, `${zh.command} ${order}`, 20),
      text(`body_c_${order}`, 104, 438, 346, 34, `${zh.caution} ${order}`, 20),
      text(`body_d_${order}`, 550, 438, 346, 34, `${zh.summary} ${order}`, 20),
    ],
  };
}

function result(order: number): { outline: SceneOutline; content: GeneratedSlideContent } {
  return { outline: outline(order), content: repeatedLayoutContent(order) };
}

describe('classroom slide deck QA', () => {
  it('blocks repeated main layout signatures across a generated deck', () => {
    const report = auditClassroomSlideContents([result(1), result(2), result(3), result(4)]);

    expect(report.pass).toBe(false);
    expect(report.blockingIssueCount).toBeGreaterThanOrEqual(3);
    expect(
      report.issues.filter((issue) => issue.type === 'repeated_layout_signature'),
    ).toHaveLength(3);
    expect(report.issues.map((issue) => issue.sceneTitle)).toContain(`${zh.title} 2`);
  });

  it('blocks orange decorative bars in future generated slides', () => {
    const content = repeatedLayoutContent(1);
    content.elements.push(shape('orange_rule', 860, 62, 58, 5, '#f97316'));

    const report = auditClassroomSlideContents([{ outline: outline(1), content }]);

    expect(report.pass).toBe(false);
    expect(report.issues.some((issue) => issue.type === 'orange_decorative_element')).toBe(true);
  });

  it('still blocks sparse pages even when they contain a table shell', () => {
    const content: GeneratedSlideContent = {
      background: { type: 'solid', color: '#ffffff' },
      remark: 'sparse table shell',
      elements: [
        text('thin_title', 72, 54, 856, 58, '\u6570\u636e\u7ed3\u6784\u901f\u89c8', 32),
        {
          id: 'thin_table',
          type: 'table',
          left: 82,
          top: 160,
          width: 836,
          height: 132,
          rotate: 0,
          outline: { color: '#cfe0f5', width: 1, style: 'solid' },
          colWidths: [0.5, 0.5],
          cellMinHeight: 42,
          data: [
            ['\u7ed3\u6784', '\u7528\u9014'],
            ['String', '\u7f13\u5b58'],
          ].map((row, rowIndex) =>
            row.map((cell, cellIndex) => ({
              id: `thin_table_${rowIndex}_${cellIndex}`,
              text: cell,
              colspan: 1,
              rowspan: 1,
              style: {
                bold: rowIndex === 0,
                color: '#1e293b',
                backcolor: rowIndex === 0 ? '#eaf4ff' : '#ffffff',
                fontsize: '18',
                fontname: 'Microsoft YaHei',
                align: 'left',
              },
            })),
          ),
        } as PPTElement,
      ],
    };

    const report = auditClassroomSlideContents([{ outline: outline(1), content }]);

    expect(report.pass).toBe(false);
    expect(report.issues.some((issue) => issue.type === 'thin_teaching_content')).toBe(true);
  });

  it('blocks keyword-only SQL pages that have layout but no real teaching substance', () => {
    const content: GeneratedSlideContent = {
      background: { type: 'solid', color: '#ffffff' },
      remark: 'keyword-only SQL page',
      elements: [
        text('sql_title', 72, 54, 856, 58, '查询数据：SELECT 语句', 32),
        text('sql_subtitle', 72, 118, 856, 42, '从表中检索数据 - 列选择、条件过滤、结果排序', 20),
        shape('sql_card_a', 82, 190, 390, 180),
        shape('sql_card_b', 528, 190, 390, 180, '#eaf4ff'),
        text('sql_select', 124, 234, 260, 42, 'SELECT', 28),
        text('sql_from', 124, 314, 260, 34, 'FROM', 18),
        text('sql_where', 570, 234, 260, 42, 'WHERE', 28),
        text('sql_order', 570, 314, 260, 34, 'ORDER BY', 18),
        text('sql_note', 216, 390, 568, 42, '指定要查询的列：* 表示全部列', 18),
      ],
    };
    const sqlOutline: SceneOutline = {
      id: 'sql_select',
      type: 'slide',
      title: '查询数据：SELECT 语句',
      description: '讲解 SQL 查询语句的列选择、条件过滤和排序。',
      keyPoints: ['SELECT 指定列', 'FROM 指定表', 'WHERE 过滤行', 'ORDER BY 排序结果'],
      order: 1,
    };

    const report = auditClassroomSlideContents([{ outline: sqlOutline, content }]);

    expect(report.pass).toBe(false);
    expect(report.issues.some((issue) => issue.type === 'insufficient_teaching_substance')).toBe(
      true,
    );
  });

  it('blocks Redis-specific fallback text on a Python slide', () => {
    const content: GeneratedSlideContent = {
      background: { type: 'solid', color: '#ffffff' },
      remark: 'python slide with leaked Redis fallback content',
      elements: [
        text('title', 72, 54, 856, 58, '第一个 Python 程序', 32),
        text(
          'body_a',
          82,
          150,
          398,
          78,
          '键值模型：一个 key 对应一个值，适合缓存配置、验证码和状态标记。',
          20,
        ),
        text(
          'body_b',
          520,
          150,
          398,
          78,
          '典型命令：SET 写入、GET 读取、INCR 计数，EXPIRE 控制有效期。',
          20,
        ),
        text(
          'body_c',
          82,
          260,
          398,
          78,
          '避坑提醒：字段很多的对象不要硬塞进 String，可改用 Hash 做局部更新。',
          20,
        ),
        text(
          'body_d',
          520,
          260,
          398,
          78,
          '本页应该讲 print() 输出和脚本运行，而不是 Redis 数据结构。',
          20,
        ),
      ],
    };
    const pythonOutline: SceneOutline = {
      id: 'python_hello',
      type: 'slide',
      title: '第一个 Python 程序',
      description: '使用 print() 函数在屏幕上显示信息',
      keyPoints: ['print() 输出', 'hello.py 文件', '终端运行'],
      order: 3,
    };

    const report = auditClassroomSlideContents([{ outline: pythonOutline, content }]);

    expect(report.pass).toBe(false);
    expect(report.issues.some((issue) => issue.type === 'semantic_domain_mismatch')).toBe(true);
  });

  it('blocks promised step counts that do not match visible step cards', () => {
    const content: GeneratedSlideContent = {
      background: { type: 'solid', color: '#ffffff' },
      remark: 'four-step title with only three rendered steps',
      elements: [
        text('title', 72, 54, 856, 58, '安装与运行环境设置', 32),
        text('subtitle', 72, 118, 856, 34, '从下载到验证，四步完成 Python 环境搭建', 20),
        text('step_1', 112, 312, 194, 96, '1 下载安装包', 18),
        text('step_2', 409, 312, 194, 96, '2 安装配置', 18),
        text('step_3', 706, 312, 194, 96, '3 编写代码', 18),
        text('takeaway', 166, 452, 668, 52, '安装后要打开终端验证 python --version', 18),
      ],
    };
    const setupOutline: SceneOutline = {
      id: 'python_setup',
      type: 'slide',
      title: '安装与运行环境设置',
      description: '从下载到验证，四步完成 Python 环境搭建',
      keyPoints: ['下载安装包', '安装配置', '编写代码', '运行验证'],
      order: 2,
    };

    const report = auditClassroomSlideContents([{ outline: setupOutline, content }]);

    expect(report.pass).toBe(false);
    expect(report.issues.some((issue) => issue.type === 'step_count_mismatch')).toBe(true);
  });

  it('blocks unsafe QA safe fallback geometry before classroom persistence', () => {
    const content: GeneratedSlideContent = {
      background: { type: 'solid', color: '#ffffff' },
      remark: 'unsafe qa safe fallback',
      elements: [
        text(
          'classroom_qa_safe_block_scene_1_0',
          82,
          148,
          398,
          62,
          '\u6838\u5fc3\u5185\u5bb9\uff1a\u8fd9\u4e2a\u6587\u5b57\u5757\u5bb9\u5668\u592a\u77ee\u4e14\u5b57\u53f7\u592a\u5c0f\u3002',
          20,
        ),
        {
          ...table('classroom_qa_safe_table_scene_1'),
          top: 360,
          height: 110,
          cellMinHeight: 27,
        } as PPTElement,
      ],
    };

    const report = auditClassroomSlideContents([{ outline: outline(1), content }]);

    expect(report.pass).toBe(false);
    expect(report.issues.some((issue) => issue.type === 'qa_safe_fallback_text_too_small')).toBe(
      true,
    );
    expect(report.issues.some((issue) => issue.type === 'qa_safe_fallback_table_too_short')).toBe(
      true,
    );
  });
});

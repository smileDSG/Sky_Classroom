/**
 * Unified Knowledge Point Relation Mapping Table
 *
 * Covers common high-school and middle-school knowledge points
 * across math, physics, and chemistry. Used by the knowledge graph builder
 * to generate prerequisite and related edges.
 *
 * Previously located at lib/mistakes/knowledge-relations.ts.
 */

import type { KnowledgeRelation } from './types';

export const KNOWLEDGE_RELATIONS: Record<string, KnowledgeRelation> = {
  // ── 数学 · 代数 ────────────────────────────────────────────────
  '因式分解': { related: ['整式乘法', '一元二次方程'] },
  '一元一次方程': { related: ['等式性质', '一元一次不等式'] },
  '一元二次方程': { prereqs: ['因式分解', '一元一次方程'], related: ['二次函数', '判别式'] },
  '二次函数': { prereqs: ['一元二次方程', '函数概念'], related: ['抛物线', '顶点坐标'] },
  '二次函数图像': { prereqs: ['二次函数'] },
  '不等式': { prereqs: ['一元一次方程'], related: ['线性规划'] },
  '一元一次不等式': { prereqs: ['一元一次方程'] },
  '数列': { prereqs: ['函数概念'], related: ['等差数列', '等比数列'] },
  '等差数列': { prereqs: ['数列'] },
  '等比数列': { prereqs: ['数列'] },
  '函数概念': { related: ['一次函数', '二次函数', '反比例函数'] },
  '一次函数': { prereqs: ['函数概念'], related: ['一元一次方程'] },
  '反比例函数': { prereqs: ['函数概念'] },
  '指数函数': { prereqs: ['函数概念'], related: ['对数函数'] },
  '对数函数': { prereqs: ['函数概念', '指数函数'] },
  '集合': { related: ['逻辑'] },
  '逻辑': { related: ['集合'] },

  // ── 数学 · 几何 ────────────────────────────────────────────────
  '三角形': { related: ['全等三角形', '相似三角形', '三角函数'] },
  '全等三角形': { prereqs: ['三角形'], related: ['相似三角形'] },
  '相似三角形': { prereqs: ['全等三角形'], related: ['三角函数'] },
  '圆': { prereqs: ['三角形'], related: ['圆周角', '切线'] },
  '圆周角': { prereqs: ['圆'] },
  '切线': { prereqs: ['圆'] },
  '三角函数': { prereqs: ['直角三角形', '相似三角形'], related: ['正弦定理', '余弦定理'] },
  '直角三角形': { prereqs: ['三角形'], related: ['勾股定理'] },
  '勾股定理': { prereqs: ['直角三角形'] },
  '正弦定理': { prereqs: ['三角函数'] },
  '余弦定理': { prereqs: ['三角函数'] },
  '立体几何': { prereqs: ['三角形'], related: ['空间向量'] },
  '空间向量': { prereqs: ['立体几何'] },
  '解析几何': { prereqs: ['函数概念', '三角形'], related: ['直线', '圆锥曲线'] },
  '直线': { prereqs: ['解析几何'] },
  '圆锥曲线': { prereqs: ['解析几何'] },
  '向量': { related: ['空间向量'] },
  '抛物线': { prereqs: ['二次函数'], related: ['圆锥曲线'] },

  // ── 数学 · 概率统计 ────────────────────────────────────────────
  '概率': { related: ['统计', '排列组合'] },
  '统计': { related: ['概率', '平均数', '方差'] },
  '排列组合': { related: ['概率', '二项式定理'] },
  '二项式定理': { prereqs: ['排列组合'] },
  '平均数': { related: ['统计', '方差'] },
  '方差': { prereqs: ['平均数'], related: ['统计'] },

  // ── 物理 · 力学 ────────────────────────────────────────────────
  '力的概念': { related: ['牛顿第一定律', '重力'] },
  '重力': { prereqs: ['力的概念'] },
  '牛顿第一定律': { prereqs: ['力的概念'], related: ['牛顿第二定律'] },
  '牛顿第二定律': { prereqs: ['力的概念', '加速度'], related: ['牛顿第三定律'] },
  '牛顿第三定律': { prereqs: ['牛顿第二定律'] },
  '加速度': { related: ['速度', '牛顿第二定律'] },
  '速度': { related: ['加速度', '位移'] },
  '位移': { related: ['速度'] },
  '功': { prereqs: ['力的概念'], related: ['动能定理', '功率'] },
  '功率': { prereqs: ['功'] },
  '动能定理': { prereqs: ['牛顿第二定律', '功'], related: ['机械能守恒'] },
  '机械能守恒': { prereqs: ['动能定理', '势能'] },
  '势能': { prereqs: ['功'] },
  '动量': { prereqs: ['牛顿第二定律'], related: ['动量守恒'] },
  '动量守恒': { prereqs: ['动量'] },
  '能量': { related: ['动能定理', '机械能守恒'] },
  '摩擦力': { prereqs: ['力的概念'] },
  '弹力': { prereqs: ['力的概念'] },

  // ── 物理 · 电学 ────────────────────────────────────────────────
  '电流': { related: ['电压', '电阻'] },
  '电压': { related: ['电流', '电阻'] },
  '电阻': { related: ['电流', '电压'] },
  '欧姆定律': { prereqs: ['电流', '电压'], related: ['电功率', '串并联'] },
  '串并联': { prereqs: ['欧姆定律'] },
  '电功率': { prereqs: ['欧姆定律', '功'] },
  '电场': { related: ['电势', '库仑定律'] },
  '电势': { prereqs: ['电场'] },
  '库仑定律': { prereqs: ['电场'] },
  '磁场': { related: ['安培力', '洛伦兹力'] },
  '安培力': { prereqs: ['磁场', '电流'] },
  '洛伦兹力': { prereqs: ['磁场', '电场'] },
  '电磁感应': { prereqs: ['磁场', '电流'] },

  // ── 物理 · 其他 ────────────────────────────────────────────────
  '光的折射': { related: ['光的反射'] },
  '光的反射': { related: ['光的折射'] },
  '热力学': { related: ['温度', '热量'] },
  '原子结构': { related: ['核反应'] },

  // ── 化学 ────────────────────────────────────────────────────────
  '化合价': { related: ['化学式', '氧化还原反应'] },
  '化学式': { prereqs: ['化合价'] },
  '氧化还原反应': { prereqs: ['化合价'], related: ['离子反应'] },
  '离子反应': { prereqs: ['氧化还原反应'] },
  '化学反应速率': { related: ['化学平衡'] },
  '化学平衡': { prereqs: ['化学反应速率'], related: ['勒夏特列原理'] },
  '勒夏特列原理': { prereqs: ['化学平衡'] },
  '有机化学': { related: ['烃', '官能团'] },
  '烃': { prereqs: ['有机化学'] },
  '官能团': { prereqs: ['有机化学'] },
  '元素周期表': { related: ['原子结构', '化学键'] },
  '化学键': { prereqs: ['元素周期表'] },
  '溶液': { related: ['浓度', '溶解度'] },
  '浓度': { prereqs: ['溶液'] },
  '电解质': { related: ['离子反应'] },
};

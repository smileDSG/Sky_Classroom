# Template Pack 精确映射验证文件夹

## 用途
每套模板完成精确映射后，用户和AI共同在此验证生成效果。

## 文件命名规范
- `{templateId}_ai.pptx` — AI自动生成的PPT样例
- `{templateId}_user.pptx` — 用户导出检查的PPT样例
- `{templateId}_issues.md` — 该模板发现的问题记录

## 当前进度
| 模板 | AI测试 | 用户测试 | 状态 |
|------|--------|---------|------|
| tech | ✅ | 待验证 | 已完成精确映射 |
| classical | ✅ | 待验证 | 已完成精确映射 |
| cartoon | 待 | 待 | 未开始 |
| ocean | 待 | 待 | 未开始 |
| watercolor | 待 | 待 | 未开始 |
| modern-geometric | 待 | 待 | 未开始 |
| nordic | 待 | 待 | 未开始 |
| business | 待 | 待 | 未开始 |
| humanistic | 待 | 待 | 未开始 |
| nature | 待 | 待 | 未开始 |
| sports | 待 | 待 | 未开始 |
| vintage | 待 | 待 | 未开始 |

## 问题记录格式（{templateId}_issues.md）
```markdown
# {templateName} 问题记录

## Slide X - {pageType}
- [ ] 问题描述：...
- [ ] 期望效果：...
- [ ] 截图/说明：...
```

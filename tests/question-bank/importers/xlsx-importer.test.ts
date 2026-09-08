import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createXlsxImporter } from '@/lib/question-bank/importers/xlsx-importer';

// ── Mock xlsx library ───────────────────────────────────────────────

const mockSheetToJson = vi.fn();
const mockRead = vi.fn();

vi.mock('xlsx', () => ({
  read: (...args: any[]) => mockRead(...args),
  utils: {
    sheet_to_json: (...args: any[]) => mockSheetToJson(...args),
  },
}));

// ── Helper: build a mock workbook ───────────────────────────────────

let _currentSheets: Record<string, Record<string, unknown>[]> = {};

function makeWorkbook(sheets: Record<string, Record<string, unknown>[]>) {
  _currentSheets = sheets;
  const sheetObjs: Record<string, { _testName: string }> = {};
  for (const name of Object.keys(sheets)) {
    sheetObjs[name] = { _testName: name };
  }
  return {
    SheetNames: Object.keys(sheets),
    Sheets: sheetObjs,
  };
}

function mockSheetData(sheets: Record<string, Record<string, unknown>[]>) {
  mockRead.mockReturnValue(makeWorkbook(sheets));
  mockSheetToJson.mockImplementation((worksheet: { _testName?: string }) => {
    const name = worksheet?._testName;
    return name ? (_currentSheets[name] ?? []) : [];
  });
}

// ── Tests ───────────────────────────────────────────────────────────

describe('createXlsxImporter', () => {
  const importer = createXlsxImporter();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses a single-sheet Excel with English headers', async () => {
    mockSheetData({
      Sheet1: [
        { subject: '数学', content: '1+1=?', answer: '2' },
        { subject: '物理', content: 'F=ma', answer: 'a=F/m' },
      ],
    });

    const result = await importer.parse(Buffer.from('fake'));
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].subject).toBe('数学');
    expect(result.entries[0].content).toBe('1+1=?');
    expect(result.rawErrors).toHaveLength(0);
    expect(result.meta.totalRows).toBe(2);
  });

  it('parses a single-sheet Excel with Chinese headers', async () => {
    mockSheetData({
      工作表1: [
        { 学科: '数学', 题目: '1+1=?', 答案: '2' },
        { 学科: '物理', 题目: 'F=ma', 答案: 'a=F/m' },
      ],
    });

    const result = await importer.parse(Buffer.from('fake'));
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].subject).toBe('数学');
    expect(result.entries[0].content).toBe('1+1=?');
  });

  it('supports multiple sheets', async () => {
    mockSheetData({
      数学: [{ content: '1+1=?', answer: '2' }],
      物理: [{ content: 'F=ma', answer: 'a=F/m' }],
    });

    const result = await importer.parse(Buffer.from('fake'));
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].subject).toBe('数学');
    expect(result.entries[1].subject).toBe('物理');
  });

  it('uses non-default sheet names as subject default', async () => {
    mockSheetData({
      Sheet1: [{ subject: '数学', content: '1+1=?', answer: '2' }],
      化学: [{ content: 'H2O=?', answer: '水' }],
    });

    const result = await importer.parse(Buffer.from('fake'));
    expect(result.entries).toHaveLength(2);
    // Sheet1 row has explicit subject; 化学 row gets sheet name as default
    expect(result.entries[0].subject).toBe('数学');
    expect(result.entries[1].subject).toBe('化学');
  });

  it('skips empty sheets silently', async () => {
    mockSheetData({
      Sheet1: [{ subject: '数学', content: '1+1=?', answer: '2' }],
      EmptySheet: [],
    });

    const result = await importer.parse(Buffer.from('fake'));
    expect(result.entries).toHaveLength(1);
    expect(result.meta.totalRows).toBe(1);
  });

  it('handles ArrayBuffer input', async () => {
    mockSheetData({
      Sheet1: [{ subject: '数学', content: '1+1=?', answer: '2' }],
    });

    const result = await importer.parse(new ArrayBuffer(8));
    expect(result.entries).toHaveLength(1);
  });

  it('returns error for unreadable buffer', async () => {
    mockRead.mockImplementation(() => {
      throw new Error('Corrupted file');
    });

    const result = await importer.parse(Buffer.from('fake'));
    expect(result.entries).toHaveLength(0);
    expect(result.rawErrors[0].reason).toContain('Excel 解析失败');
    expect(result.rawErrors[0].reason).toContain('Corrupted file');
  });

  it('validates required fields', async () => {
    mockSheetData({
      Sheet1: [
        { subject: '数学', content: '1+1=?', answer: '2' },
        { subject: '数学', content: '', answer: '' },
      ],
    });

    const result = await importer.parse(Buffer.from('fake'));
    expect(result.entries.length).toBeLessThan(2);
    expect(result.rawErrors.length).toBeGreaterThan(0);
  });

  it('enforces maxRows limit', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({
      subject: '数学',
      content: `题${i}`,
      answer: '1',
    }));
    mockSheetData({ Sheet1: rows });

    const result = await importer.parse(Buffer.from('fake'), { maxRows: 1000 });
    expect(result.entries).toHaveLength(0);
    expect(result.rawErrors[0].reason).toContain('超过限制');
  });

  it('respects skipValidation option', async () => {
    mockSheetData({
      Sheet1: [
        { subject: '数学', content: '1+1=?', answer: '2' },
        { subject: '', content: '', answer: '' },
      ],
    });

    const result = await importer.parse(Buffer.from('fake'), { skipValidation: true });
    expect(result.entries).toHaveLength(2);
    expect(result.rawErrors).toHaveLength(0);
  });

  it('applies custom defaultValues', async () => {
    mockSheetData({
      Sheet1: [{ content: '1+1=?', answer: '2' }],
    });

    const result = await importer.parse(Buffer.from('fake'), {
      defaultValues: { subject: '默认学科', grade: '高一' },
    });
    expect(result.entries[0].subject).toBe('默认学科');
    expect(result.entries[0].grade).toBe('高一');
  });

  it('handles sheets named with default names (case-insensitive)', async () => {
    mockSheetData({
      SHEET1: [{ subject: '数学', content: '1+1=?', answer: '2' }],
      工作表2: [{ subject: '物理', content: '2+2=?', answer: '4' }],
    });

    const result = await importer.parse(Buffer.from('fake'));
    expect(result.entries).toHaveLength(2);
    // Default sheet names do not auto-fill subject
    expect(result.entries[0].subject).toBe('数学');
    expect(result.entries[1].subject).toBe('物理');
  });
});

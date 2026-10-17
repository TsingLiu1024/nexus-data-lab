import { expect, test } from '@playwright/test'

test('restoring the filter limit keeps the UI bounded and refuses an additional condition', async ({
  page,
}) => {
  await page.goto('/')
  const snapshot = {
    schema: 1,
    savedAt: new Date().toISOString(),
    dataset: {
      name: 'limits.csv',
      byteSize: 20,
      warnings: [],
      columns: [
        { key: 'c0', label: '名称', type: 'text' },
        { key: 'c1', label: '金额', type: 'number' },
      ],
      rows: [{ c0: 'A', c1: '1' }],
    },
    preferences: {
      query: '',
      filters: Array.from({ length: 32 }, () => ({ column: 'c0', operator: 'eq', value: 'A' })),
      sort: null,
      page: 1,
      view: 'table',
      demo: false,
      settings: { dimension: 'c0', category: 'c0', metric: 'c1', mode: 'sum', kind: 'bar' },
    },
  }
  await page.getByLabel('导入工作区备份', { exact: true }).setInputFiles({
    name: 'limits.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ format: 'nexus-workspace', version: 1, name: '最多条件', snapshot }),
    ),
  })
  await expect(page.getByTestId('saved-workspace')).toContainText('最多条件')
  await page.getByRole('button', { name: '恢复工作区', exact: true }).click()
  await expect(page.getByTestId('row-count')).toHaveText('1')
  await expect(page.locator('.filter-chip')).toHaveCount(32)
  await expect(page.getByPlaceholder('搜索所有字段…')).toHaveAttribute('maxlength', '4096')
  await page.locator('.filter-button').click()
  await page.getByLabel('筛选值', { exact: true }).fill('A')
  await expect(page.getByLabel('筛选值', { exact: true })).toHaveAttribute('maxlength', '4096')
  await page.getByRole('button', { name: '应用筛选', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('最多支持 32')
  await expect(page.locator('.filter-chip')).toHaveCount(32)
})

import { test, expect } from '@playwright/test'

const fixture = '日期,渠道,销售额,编号\n2026-01-01,官网,100,001\n2026-01-02,门店,20,002\n2026-01-03,官网,30,003\n2026-01-04,门店,,004'

test.beforeEach(async ({ page }) => { await page.goto('/') })

test('demo loads, chart choices work, and the workspace has no runtime errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await expect(page.getByRole('heading', { name: '让数据，清晰可见。' })).toBeVisible()
  await expect(page.getByText('零售经营数据.csv', { exact: true }).first()).toBeVisible()
  await expect(page.getByTestId('row-count')).toHaveText('360')
  await page.getByRole('button', { name: '柱状图', exact: true }).click()
  await page.getByLabel('聚合方式').selectOption('mean')
  await page.getByLabel('图表维度').selectOption({ label: '地区' })
  await expect(page.getByTestId('trend-chart').locator('.recharts-bar')).toBeVisible()
  expect(errors).toEqual([])
})

test('import → query → filter → export all use the same rows', async ({ page }) => {
  await page.getByRole('button', { name: '导入数据', exact: true }).click()
  await page.getByLabel('选择 CSV 文件').setInputFiles({ name: 'sales.csv', mimeType: 'text/csv', buffer: Buffer.from(fixture) })
  await expect(page.getByTestId('row-count')).toHaveText('4')
  await expect(page.getByRole('cell', { name: '001', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '按销售额排序' }).click()
  await expect(page.locator('tbody tr').first().getByRole('cell', { name: '002', exact: true })).toBeVisible()
  await expect(page.locator('tbody tr').last().getByRole('cell', { name: '004', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '按销售额排序' }).click()
  await expect(page.locator('tbody tr').first().getByRole('cell', { name: '001', exact: true })).toBeVisible()
  await page.getByPlaceholder('搜索所有字段…').fill('官网')
  await expect(page.getByTestId('row-count')).toHaveText('2')
  await expect(page.getByTestId('metric-total')).toContainText('130')
  await page.getByRole('button', { name: '筛选', exact: true }).click()
  await page.getByLabel('筛选字段').selectOption('c2')
  await page.getByLabel('筛选条件', { exact: true }).selectOption('gt')
  await page.getByLabel('筛选值').fill('50')
  await page.getByRole('button', { name: '应用筛选' }).click()
  await expect(page.getByTestId('row-count')).toHaveText('1')
  await expect(page.getByTestId('metric-total')).toContainText('100')
  await page.getByRole('button', { name: '导出结果', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 CSV' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('sales-filtered.csv')
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  const output = Buffer.concat(chunks).toString('utf8')
  expect(output).toContain('官网,100,001')
  expect(output).not.toContain('门店')
  await page.getByRole('button', { name: '重置筛选' }).click()
  await expect(page.getByTestId('row-count')).toHaveText('4')
})

test('numeric sort, pagination, column profiles and empty results are usable', async ({ page }) => {
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page.getByText('21–40', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '字段分析', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: '字段画像' })).toBeVisible()
  await page.getByRole('button', { name: '数据表格', exact: true }).first().click()
  await page.getByPlaceholder('搜索所有字段…').fill('不存在的数据')
  await expect(page.getByText('没有匹配的记录')).toBeVisible()
  await expect(page.getByTestId('row-count')).toHaveText('0')
  await page.getByRole('button', { name: '重置筛选' }).click()
  await expect(page.getByTestId('row-count')).toHaveText('360')
})

test('invalid imports preserve current dataset, dialog traps focus and closes with Escape', async ({ page }) => {
  await page.getByRole('button', { name: '导入数据', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByLabel('文件编码', { exact: false })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '关闭导入窗口' })).toBeFocused()
  await page.getByLabel('选择 CSV 文件').setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\nx,1,extra') })
  await expect(page.getByRole('alert')).toContainText('列')
  await expect(page.getByTestId('row-count')).toHaveText('360')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('button', { name: '导入数据', exact: true })).toBeFocused()
})

test('text-only CSV supports count charts, JSON export and restoring demo', async ({ page }) => {
  await page.getByRole('button', { name: '导入数据', exact: true }).click()
  await page.getByLabel('选择 CSV 文件').setInputFiles({ name: 'names.csv', mimeType: 'text/csv', buffer: Buffer.from('姓名,城市\n小明,北京\n小红,上海\n小李,北京') })
  await expect(page.getByTestId('row-count')).toHaveText('3')
  await expect(page.getByLabel('图表指标')).toHaveValue('__count__')
  await page.getByRole('button', { name: '导出结果', exact: true }).click()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出 JSON' }).click()
  expect((await pending).suggestedFilename()).toBe('names-filtered.json')
  await page.getByRole('button', { name: '加载演示数据', exact: true }).first().click()
  await expect(page.getByTestId('row-count')).toHaveText('360')
})

test('mobile layout stays within viewport and import remains accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: '让数据，清晰可见。' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: '导入数据', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('GB18030 import works and unsupported encodings can be corrected without losing data', async ({ page }) => {
  await page.getByRole('button', { name: '导入数据', exact: true }).click()
  // GBK subset of GB18030: 姓名,城市\n张三,北京
  const buffer = Buffer.from('d0d5c3fb2cb3c7cad00ad5c5c8fd2cb1b1bea9', 'hex')
  await page.getByLabel('选择 CSV 文件').setInputFiles({ name: '中文.csv', mimeType: 'text/csv', buffer })
  await expect(page.getByRole('alert')).toContainText('编码')
  await expect(page.getByTestId('row-count')).toHaveText('360')
  await page.getByLabel('文件编码').selectOption('gb18030')
  await page.getByLabel('选择 CSV 文件').setInputFiles({ name: '中文.csv', mimeType: 'text/csv', buffer })
  await expect(page.getByTestId('row-count')).toHaveText('1')
  await expect(page.getByRole('cell', { name: '张三', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: '北京', exact: true })).toBeVisible()
})

test('summary totals retain cents from decimal-valued imports', async ({ page }) => {
  await page.getByRole('button', { name: '导入数据', exact: true }).click()
  await page.getByLabel('选择 CSV 文件').setInputFiles({ name: 'decimal.csv', mimeType: 'text/csv', buffer: Buffer.from('渠道,金额\n官网,100.25\n门店,20.5') })
  await expect(page.getByTestId('metric-total')).toHaveText('120.75')
})

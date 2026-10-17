import { expect, test } from '@playwright/test'

test('configured import previews before committing and preserves raw identifiers and date order', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: '导入数据', exact: true }).click()
  await page.getByLabel('分隔符', { exact: true }).selectOption(';', { timeout: 3000 })
  await page.getByLabel('日期格式', { exact: true }).selectOption('dmy-slash')
  await page.getByLabel('选择 CSV 文件').setInputFiles({
    name: 'configured.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('编号;日期;金额\n001;02/01/2026;1.00\n002;01/12/2025;1'),
  })
  await expect(page.getByRole('heading', { name: '导入预览' })).toBeVisible()
  await expect(page.getByTestId('row-count')).toHaveText('360')
  await page.getByLabel('编号 类型', { exact: true }).selectOption('text')
  await page.getByLabel('金额 类型', { exact: true }).selectOption('number')
  await page.getByRole('button', { name: '确认导入', exact: true }).click()
  await expect(page.getByTestId('row-count')).toHaveText('2')
  await page.getByRole('button', { name: '按日期排序' }).click()
  await expect(
    page.locator('tbody tr').first().getByRole('cell', { name: '002', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: '保存工作区', exact: true }).click()
  await expect(page.getByTestId('saved-workspace')).toContainText('configured.csv')
  await page.reload()
  await page.getByRole('button', { name: '恢复工作区', exact: true }).click()
  await expect(
    page.locator('tbody tr').first().getByRole('cell', { name: '002', exact: true }),
  ).toBeVisible()
})

test('failed type conversion and cancelling a preview leave the previous dataset intact', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: '导入数据', exact: true }).click()
  await page.getByLabel('选择 CSV 文件').setInputFiles({
    name: 'mixed.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('名称,金额\nA,N/A\nB,10'),
  })
  await page.getByLabel('金额 类型', { exact: true }).selectOption('number', { timeout: 3000 })
  await page.getByRole('button', { name: '确认导入', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('金额')
  await expect(page.getByTestId('row-count')).toHaveText('360')
  await page.getByRole('button', { name: '取消导入', exact: true }).click()
  await expect(page.getByTestId('row-count')).toHaveText('360')
})

test('changed parsing settings require an updated preview before confirmation', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: '导入数据', exact: true }).click()
  await page.getByLabel('选择 CSV 文件').setInputFiles({
    name: 'semicolon.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('名称;金额\nA;10\nB;20'),
  })
  await expect(page.getByRole('heading', { name: '导入预览' })).toBeVisible({ timeout: 3000 })
  await page.getByLabel('分隔符', { exact: true }).selectOption(',')
  await expect(page.getByRole('button', { name: '确认导入', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '更新预览', exact: true }).click()
  await expect(page.getByLabel('名称;金额 类型', { exact: true })).toBeVisible()
  await page.getByLabel('分隔符', { exact: true }).selectOption(';')
  await page.getByRole('button', { name: '更新预览', exact: true }).click()
  await expect(page.getByLabel('金额 类型', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '确认导入', exact: true }).click()
  await expect(page.getByTestId('metric-total')).toHaveText('30')
})

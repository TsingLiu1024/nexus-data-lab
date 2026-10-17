import { expect, test, type Page } from '@playwright/test'

async function importCsv(page: Page, csv: string, dateFormat = 'iso') {
  await page.goto('/')
  await page.getByRole('button', { name: '导入数据', exact: true }).click()
  await page.getByLabel('日期格式', { exact: true }).selectOption(dateFormat)
  await page
    .getByLabel('选择 CSV 文件')
    .setInputFiles({ name: 'axis.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: '确认导入', exact: true }).click()
  await expect(page.getByTestId('row-count')).not.toHaveText('360')
  await page.getByLabel('图表维度').selectOption('c0')
  await page.getByLabel('图表指标').selectOption('c1')
}

test('single dates render in both chart kinds and text dimensions keep category labels', async ({
  page,
}) => {
  await importCsv(page, '日期,金额\n2026-01-01,10\n,7')
  await page.getByRole('button', { name: '折线图', exact: true }).click()
  await expect(page.getByTestId('trend-chart').locator('.recharts-area-dots circle')).toHaveCount(1)
  await page.getByRole('button', { name: '柱状图', exact: true }).click()
  await expect(page.getByTestId('trend-chart').locator('.recharts-bar-rectangle path')).toHaveCount(
    1,
  )
  await expect(page.getByTestId('unplaced-groups')).toContainText('7')
  await importCsv(page, '分类,金额\nA ~ B,10\nC,20')
  await expect(page.getByTestId('trend-chart')).toContainText('A ~ B')
  await expect(page.getByTestId('unplaced-groups')).toHaveCount(0)
})

test('merged bins retain their complete range in the tooltip', async ({ page }) => {
  await importCsv(
    page,
    '位置,金额\n' + Array.from({ length: 31 }, (_, i) => `${i + 1},${i + 1}`).join('\n'),
  )
  await page.getByRole('button', { name: '折线图', exact: true }).click()
  const dots = page.getByTestId('trend-chart').locator('.recharts-area-dots circle')
  await expect(dots).toHaveCount(16)
  await dots.first().hover()
  await expect(page.getByTestId('trend-chart').locator('.recharts-tooltip-label')).toHaveText(
    '1 ~ 2',
  )
  await expect(page.locator('.chart-foot')).toContainText('区间按中点定位')
})

test('fractional numeric ticks preserve distinct values instead of rounding them all to zero', async ({
  page,
}) => {
  for (const [a, b, c] of [
    ['0.1', '0.2', '0.3'],
    ['-0.3', '-0.2', '-0.1'],
    ['1e-8', '2e-8', '3e-8'],
  ]) {
    await importCsv(page, `位置,金额\n${a},10\n${b},20\n${c},30`)
    const ticks = page
      .getByTestId('trend-chart')
      .locator('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value')
    await expect.poll(() => ticks.allTextContents()).toContain(Number(a).toString())
    await expect.poll(() => ticks.allTextContents()).toContain(Number(c).toString())
    expect(new Set(await ticks.allTextContents()).size).toBeGreaterThan(2)
  }
})

async function positions(page: Page, kind: 'area' | 'bar') {
  await page
    .getByRole('button', { name: kind === 'area' ? '折线图' : '柱状图', exact: true })
    .click()
  const selector = kind === 'area' ? '.recharts-area-dots circle' : '.recharts-bar-rectangle path'
  const shapes = page.getByTestId('trend-chart').locator(selector)
  await expect(shapes).toHaveCount(3)
  return shapes.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect()
      return box.x + box.width / 2
    }),
  )
}

for (const kind of ['area', 'bar'] as const) {
  test(`${kind}: numeric X distances are proportional and missing groups remain visible`, async ({
    page,
  }) => {
    await importCsv(page, '位置,金额\n-10,10\n-9,20\n90,30\n,7')
    const x = await positions(page, kind)
    expect((x[2] - x[1]) / (x[1] - x[0])).toBeCloseTo(99, 0)
    await expect(page.getByTestId('unplaced-groups')).toContainText('（缺失）')
    await expect(page.getByTestId('unplaced-groups')).toContainText('7')
  })

  test(`${kind}: configured dates use elapsed days across year boundaries`, async ({ page }) => {
    await importCsv(page, '日期,金额\n31/12/2025,10\n01/01/2026,20\n10/04/2026,30', 'dmy-slash')
    const x = await positions(page, kind)
    expect((x[2] - x[1]) / (x[1] - x[0])).toBeCloseTo(99, 0)
    await expect(page.getByTestId('trend-chart')).toContainText('2026')
  })
}

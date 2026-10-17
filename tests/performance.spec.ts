import { expect, test } from '@playwright/test'

test('large imports run in a real worker and the latest search wins', async ({ page }) => {
  const workers: string[] = []
  page.on('worker', worker => workers.push(worker.url()))
  await page.goto('/')
  await expect(page.getByTestId('row-count')).toHaveText('360')
  await expect.poll(() => workers.length).toBeGreaterThan(0)
  await page.evaluate(() => {
    const state = { ticks: 0, maximumTaskMs: 0, timer: 0 }
    Object.assign(window, { nexusTiming: state })
    state.timer = window.setInterval(() => state.ticks++, 25)
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) state.maximumTaskMs = Math.max(state.maximumTaskMs, entry.duration)
    }).observe({ type: 'longtask', buffered: false })
  })
  const csv = '编号,城市,金额\n' + Array.from({ length: 50_000 }, (_, i) => `ID${i},${i % 2 ? '上海' : '北京'},${i % 1000}`).join('\n')
  await page.getByRole('button', { name: '导入数据', exact: true }).click()
  await page.getByLabel('选择 CSV 文件').setInputFiles({ name: 'large.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(page.getByTestId('row-count')).toHaveText('50,000')
  const timing = await page.evaluate(() => {
    const state = (window as unknown as { nexusTiming: { ticks: number; maximumTaskMs: number; timer: number } }).nexusTiming
    clearInterval(state.timer)
    return { ticks: state.ticks, maximumTaskMs: state.maximumTaskMs }
  })
  console.log('50,000-row browser main-thread check:', JSON.stringify(timing))
  expect(timing.ticks).toBeGreaterThan(2)
  expect(timing.maximumTaskMs).toBeLessThan(1000)
  await expect(page.locator('tbody tr')).toHaveCount(20)
  const input = page.getByPlaceholder('搜索所有字段…')
  await input.fill('上海')
  await input.fill('不存在')
  await input.fill('北京')
  await expect(page.getByTestId('row-count')).toHaveText('25,000')
  await expect(page.getByRole('cell', { name: '北京', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('cell', { name: '上海', exact: true })).toHaveCount(0)
})

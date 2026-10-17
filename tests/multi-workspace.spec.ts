import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function csv(page: Page, name: string, text: string) {
  await page.getByRole('button', { name: '导入数据', exact: true }).click()
  await page
    .getByLabel('选择 CSV 文件')
    .setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(text) })
  await page.getByRole('button', { name: '确认导入', exact: true }).click()
}

test('two named workspaces, rename, portable backup and deletion preserve independent data', async ({
  page,
}) => {
  await page.goto('/')
  await csv(page, 'first.csv', '编号,金额\n001,1.00\n002,2')
  await page.getByLabel('工作区名称', { exact: true }).fill('一月分析')
  await page.getByRole('button', { name: '保存工作区', exact: true }).click()
  await expect(page.getByTestId('saved-workspace')).toContainText('一月分析')
  await csv(page, 'second.csv', '编号,金额\nA,10\nB,20\nC,30')
  await page.getByLabel('工作区名称', { exact: true }).fill('二月分析')
  await page.getByRole('button', { name: '保存工作区', exact: true }).click()
  const picker = page.getByLabel('已保存的工作区', { exact: true })
  await expect(picker.locator('option')).toHaveCount(3)
  await picker.selectOption({ label: '一月分析' })
  await page.getByRole('button', { name: '恢复工作区', exact: true }).click()
  await expect(page.getByTestId('row-count')).toHaveText('2')
  await expect(page.getByRole('cell', { name: '001', exact: true })).toBeVisible()
  await page.getByLabel('工作区名称', { exact: true }).fill('一月复核')
  await page.getByRole('button', { name: '重命名工作区', exact: true }).click()
  await expect(picker.locator('option', { hasText: '一月复核' })).toHaveCount(1)
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出存档', exact: true }).click()
  const download = await downloading
  const backup = JSON.parse(await readFile((await download.path())!, 'utf-8'))
  expect(backup.snapshot.dataset.rows[0].c1).toBe('1.00')
  await page.getByLabel('导入工作区备份', { exact: true }).setInputFiles((await download.path())!)
  await expect(picker.locator('option')).toHaveCount(4)
  await expect(page.getByTestId('saved-workspace')).toContainText('副本')
  await page.getByRole('button', { name: '删除存档', exact: true }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect(picker.locator('option')).toHaveCount(3)
  await page.reload()
  await picker.selectOption({ label: '二月分析' })
  await page.getByRole('button', { name: '恢复工作区', exact: true }).click()
  await expect(page.getByTestId('row-count')).toHaveText('3')
  await expect(page.getByTestId('metric-total')).toHaveText('60')
})

test('old single-slot workspaces migrate on refresh and preserve query and raw rows', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('row-count')).toHaveText('360')
  await page.evaluate(async () => {
    const record = {
      schema: 1,
      savedAt: new Date().toISOString(),
      dataset: {
        name: 'legacy.csv',
        byteSize: 50,
        warnings: [],
        columns: [
          { key: 'c0', label: '城市', type: 'text' },
          { key: 'c1', label: '金额', type: 'number' },
        ],
        rows: [
          { c0: '上海', c1: '1.00' },
          { c0: '北京', c1: '2' },
        ],
      },
      preferences: {
        query: '上海',
        filters: [],
        sort: null,
        page: 1,
        view: 'table',
        demo: false,
        settings: { dimension: 'c0', category: 'c0', metric: 'c1', mode: 'sum', kind: 'bar' },
      },
    }
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('nexus-data-lab', 1)
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction('workspaces', 'readwrite')
        transaction.objectStore('workspaces').put(record, 'current')
        transaction
          .objectStore('workspaces')
          .put({ name: 'legacy.csv', count: 2, savedAt: record.savedAt }, 'metadata')
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
        transaction.onabort = () => {
          database.close()
          reject(transaction.error)
        }
      }
      request.onerror = () => reject(request.error)
    })
  })
  await page.reload()
  await expect(page.getByTestId('saved-workspace')).toContainText('legacy.csv')
  await page.getByRole('button', { name: '恢复工作区', exact: true }).click()
  await expect(page.getByTestId('row-count')).toHaveText('1')
  await expect(page.getByPlaceholder('搜索所有字段…')).toHaveValue('上海')
  await expect(page.getByRole('cell', { name: '上海', exact: true })).toBeVisible()
})

test('another tab cannot overwrite a renamed workspace until its list is refreshed', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保存工作区', exact: true }).click()
  await expect(page.getByRole('button', { name: '恢复工作区', exact: true })).toBeEnabled()
  const other = await page.context().newPage()
  await other.goto('/')
  await expect(other.getByRole('button', { name: '恢复工作区', exact: true })).toBeEnabled()
  await page.getByLabel('工作区名称', { exact: true }).fill('最新版本')
  await page.getByRole('button', { name: '重命名工作区', exact: true }).click()
  await expect(page.getByTestId('saved-workspace')).toContainText('最新版本')
  await other.getByRole('button', { name: '保存工作区', exact: true }).click()
  await expect(other.getByRole('alert')).toContainText('其他页面更新')
  await other.getByRole('button', { name: '刷新存档列表', exact: true }).click()
  await expect(other.getByTestId('saved-workspace')).toContainText('最新版本')
  await other.close()
})

test('invalid backup imports leave active data and saved workspaces untouched', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: '保存工作区', exact: true }).click()
  await page.getByLabel('导入工作区备份', { exact: true }).setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"nexus-workspace","version":99}'),
  })
  await expect(page.getByRole('alert')).toContainText('备份')
  await expect(page.getByTestId('row-count')).toHaveText('360')
  await expect(page.getByLabel('已保存的工作区', { exact: true }).locator('option')).toHaveCount(2)
})

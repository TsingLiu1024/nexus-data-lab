import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, writeFile, mkdir, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inspectService, buildFingerprint, launchDecision } from './start.mjs'
import { exitWithin } from './launcher-test-utils.mjs'

test('child-exit deadlines reject stalled waits and allow cleanup to run', async () => {
  let cleaned = false
  const delayedExit = new Promise((resolve) => setTimeout(() => resolve(0), 120))
  await assert.rejects(async () => {
    try {
      await exitWithin(delayedExit, 20)
    } finally {
      cleaned = true
    }
  }, /did not exit/)
  assert.equal(cleaned, true)
  assert.equal(await exitWithin(Promise.resolve(0)), 0)
})

test('identifies our app and refuses to reuse an unrelated local server', async () => {
  const server = createServer((request, response) => {
    response.end(
      request.url === '/nexus'
        ? '<meta name="application-name" content="NEXUS Data Lab">'
        : '<h1>Another app</h1>',
    )
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const url = `http://127.0.0.1:${server.address().port}`
    assert.equal(await inspectService(url + '/nexus'), 'nexus')
    assert.equal(await inspectService(url + '/other'), 'other')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('source fingerprint changes after edits but remains stable without changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nexus-launcher-'))
  const source = join(root, 'src')
  const index = join(root, 'index.html'),
    script = join(source, 'main.ts')
  await mkdir(source)
  await writeFile(index, 'index')
  await writeFile(script, 'old')
  try {
    const before = await buildFingerprint(root)
    const cached = { lock: 'same-lock', fingerprint: before }
    assert.equal(
      launchDecision('nexus', cached, { ...cached, dependenciesPresent: true, buildPresent: true }),
      'reuse',
    )
    assert.equal(await buildFingerprint(root), before)
    await writeFile(script, 'new')
    assert.notEqual(await buildFingerprint(root), before)
    const awaitFingerprint = await buildFingerprint(root)
    assert.throws(
      () =>
        launchDecision('nexus', cached, {
          lock: 'same-lock',
          fingerprint: awaitFingerprint,
          dependenciesPresent: true,
          buildPresent: true,
        }),
      /restart|out.of.date/i,
    )
  } finally {
    await unlink(index)
    await unlink(script)
    await rmdir(source)
    await rmdir(root)
  }
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectService } from './start.mjs'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const delay = ms => new Promise(resolveDone => setTimeout(resolveDone, ms))

async function listen(server) {
  await new Promise(resolveDone => server.listen(0, '127.0.0.1', resolveDone))
  return server.address().port
}

function launch(directory, port) {
  const env = { ...process.env, NEXUS_PORT: String(port) }
  // Exercise the Windows wrapper without opening a real browser during CI or local tests.
  for (const key of ['ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA']) env[key] = directory
  const windows = process.platform === 'win32'
  const child = windows
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'start.cmd'], { cwd: directory, env, windowsHide: true })
    : spawn(process.execPath, ['scripts/start.mjs', '--no-browser'], { cwd: directory, env })
  child.stdin.end()
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  const done = new Promise((resolveDone, reject) => { child.on('error', reject); child.on('exit', code => resolveDone(code)) })
  return { child, done, output: () => output }
}

async function stop(run) {
  if (run.child.exitCode !== null) return
  if (process.platform === 'win32') {
    // This PID is the wrapper created by this test; terminate only its own descendants.
    const killer = spawn('taskkill', ['/PID', String(run.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    await new Promise(resolveDone => killer.on('exit', resolveDone))
  } else run.child.kill('SIGTERM')
  await run.done
}

async function waitFor(run, fragment) {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (run.output().includes(fragment)) return
    if (run.child.exitCode !== null) assert.fail(run.output())
    await delay(100)
  }
  assert.fail(`Timed out waiting for ${fragment}: ${run.output()}`)
}

test('real launcher: Chinese path, rebuild, reuse, stale source and unrelated port', { timeout: 90_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'NEXUS 中文路径 '))
  const runs = []
  const reservation = createServer((_request, response) => response.end('Unrelated application'))
  let reservationOpen = false
  try {
    for (const name of ['src', 'public', 'scripts', 'package.json', 'package-lock.json', 'index.html', 'vite.config.ts', 'tsconfig.json', 'start.cmd']) {
      await cp(join(project, name), join(directory, name), { recursive: true })
    }
    await symlink(join(project, 'node_modules'), join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    // Reuse this test run's npm-ci installation. Force a real build from the copied source.
    const lock = createHash('sha256').update(await readFile(join(directory, 'package-lock.json'))).digest('hex')
    await writeFile(join(directory, '.nexus-launcher.local'), JSON.stringify({ lock, fingerprint: 'force-build' }))
    const port = await listen(reservation)
    reservationOpen = true
    await new Promise(resolveDone => reservation.close(resolveDone))
    reservationOpen = false

    const first = launch(directory, port); runs.push(first)
    await waitFor(first, 'NEXUS READY')
    assert.match(first.output(), /Building NEXUS/)
    assert.equal(await inspectService(`http://127.0.0.1:${port}/`), 'nexus')

    const second = launch(directory, port); runs.push(second)
    assert.equal(await second.done, 0, second.output())
    assert.match(second.output(), /already running and up to date/)

    await writeFile(join(directory, 'public', 'smoke-change.txt'), 'A new source asset')
    const stale = launch(directory, port); runs.push(stale)
    assert.notEqual(await stale.done, 0, stale.output())
    assert.match(stale.output(), /out of date/)
    assert.equal(await inspectService(`http://127.0.0.1:${port}/`), 'nexus')
    await stop(first)
    for (let attempt = 0; attempt < 50 && await inspectService(`http://127.0.0.1:${port}/`) !== 'offline'; attempt++) await delay(100)
    assert.equal(await inspectService(`http://127.0.0.1:${port}/`), 'offline')

    const rebuilt = launch(directory, port); runs.push(rebuilt)
    await waitFor(rebuilt, 'NEXUS READY')
    assert.match(rebuilt.output(), /Building NEXUS/)
    assert.equal(await (await fetch(`http://127.0.0.1:${port}/smoke-change.txt`)).text(), 'A new source asset')
    await stop(rebuilt)

    const occupiedPort = await listen(reservation)
    reservationOpen = true
    const occupied = launch(directory, occupiedPort); runs.push(occupied)
    assert.notEqual(await occupied.done, 0, occupied.output())
    assert.match(occupied.output(), /occupied by another application/)
    assert.equal(await (await fetch(`http://127.0.0.1:${occupiedPort}/`)).text(), 'Unrelated application')
  } finally {
    for (const run of runs) await stop(run)
    if (reservationOpen) await new Promise(resolveDone => reservation.close(resolveDone))
    const target = resolve(directory)
    assert.equal(dirname(target), resolve(tmpdir()))
    assert.ok(target.startsWith(join(resolve(tmpdir()), 'NEXUS 中文路径 ')))
    await rm(target, { recursive: true, force: true })
  }
})

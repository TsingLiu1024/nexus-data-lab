import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import http from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export function launchDecision(status, state, current) {
  if (status === 'other') throw new Error('The selected port is occupied by another application.')
  if (status === 'offline') return 'prepare'
  if (!current.dependenciesPresent || !current.buildPresent || state?.lock !== current.lock || state?.fingerprint !== current.fingerprint) {
    throw new Error('The running NEXUS service may be out of date. Stop its terminal with Ctrl+C, then restart start.cmd to rebuild the updated project.')
  }
  return 'reuse'
}

export async function inspectService(url) {
  return new Promise(resolveResult => {
    const request = http.get(url, response => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { body += chunk; if (body.length > 65_536) { resolveResult('other'); request.destroy() } })
      response.on('end', () => resolveResult(response.statusCode === 200 && body.includes('<meta name="application-name" content="NEXUS Data Lab"') ? 'nexus' : 'other'))
      response.on('error', () => resolveResult('other'))
    })
    request.setTimeout(1000, () => { resolveResult('other'); request.destroy() })
    request.on('error', error => resolveResult(error.code === 'ECONNREFUSED' ? 'offline' : 'other'))
  })
}

export async function buildFingerprint(directory) {
  const hash = createHash('sha256')
  async function walk(relative) {
    const absolute = join(directory, relative)
    if (!existsSync(absolute)) return
    const entries = await readdir(absolute, { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(relative, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (entry.isFile()) { hash.update(path); hash.update(await readFile(join(directory, path))) }
    }
  }
  await walk('src'); await walk('public')
  for (const name of ['index.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json']) {
    if (existsSync(join(directory, name))) { hash.update(name); hash.update(await readFile(join(directory, name))) }
  }
  return hash.digest('hex')
}

async function runNpm(args) {
  const adjacent = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  const cli = process.env.npm_execpath?.endsWith('.js') ? process.env.npm_execpath : existsSync(adjacent) ? adjacent : null
  const command = cli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const child = spawn(command, cli ? [cli, ...args] : args, { cwd: root, stdio: 'inherit', shell: !cli && process.platform === 'win32', windowsHide: true })
  await new Promise((resolveDone, reject) => {
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolveDone() : reject(new Error(`npm ${args.join(' ')} failed (${code}).`)))
  })
}

function openBrowser(url) {
  let executable, args
  if (process.platform === 'win32') {
    const candidates = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean).map(base => join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'))
    executable = candidates.find(existsSync)
    if (!executable) { console.log(`Microsoft Edge was not found. Open this address manually: ${url}`); return }
    args = ['--new-tab', url]
  } else { executable = process.platform === 'darwin' ? 'open' : 'xdg-open'; args = [url] }
  const browser = spawn(executable, args, { detached: true, stdio: 'ignore' })
  browser.on('error', () => console.log(`Open this address manually: ${url}`))
  browser.unref()
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node.js 24 or newer is required.')
  const portIndex = process.argv.indexOf('--port')
  const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : process.env.NEXUS_PORT || 4173)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port number.')
  const url = `http://127.0.0.1:${port}/`
  const browser = !process.argv.includes('--no-browser')
  const status = await inspectService(url)
  if (status === 'other') throw new Error(`Port ${port} is occupied by another application. Close it or set NEXUS_PORT.`)
  const statePath = join(root, '.nexus-launcher.local')
  let state = {}
  try { state = JSON.parse(await readFile(statePath, 'utf8')) ?? {} } catch { /* first launch */ }
  const lock = createHash('sha256').update(await readFile(join(root, 'package-lock.json'))).digest('hex')
  const fingerprint = await buildFingerprint(root)
  const decision = launchDecision(status, state, { lock, fingerprint, dependenciesPresent: existsSync(join(root, 'node_modules/vite/bin/vite.js')), buildPresent: existsSync(join(root, 'dist/index.html')) })
  if (decision === 'reuse') { console.log(`NEXUS is already running and up to date: ${url}`); if (browser) openBrowser(url); return }
  if (state.lock !== lock || !existsSync(join(root, 'node_modules/vite/bin/vite.js'))) {
    console.log('Preparing locked dependencies (first launch or updated dependencies)...')
    await runNpm(['ci'])
  }
  if (state.fingerprint !== fingerprint || !existsSync(join(root, 'dist/index.html'))) {
    console.log('Building NEXUS...')
    await runNpm(['run', 'build'])
  }
  await writeFile(statePath, JSON.stringify({ lock, fingerprint }))
  const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'inherit', windowsHide: true })
  let exited = false
  server.on('exit', code => { exited = true; process.exitCode = code ?? 1 })
  server.on('error', error => { exited = true; console.error(error.message); process.exitCode = 1 })
  const stop = () => { if (!exited) server.kill(); process.exitCode = 0 }
  process.on('SIGINT', stop); process.on('SIGTERM', stop)
  for (let attempt = 0; attempt < 40; attempt++) {
    if (exited) throw new Error('Preview server stopped before it was ready.')
    if (await inspectService(url) === 'nexus') {
      console.log(`NEXUS READY ${url}\nKeep this window open. Press Ctrl+C to stop.`)
      if (browser) openBrowser(url)
      return
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 250))
  }
  server.kill()
  throw new Error('Preview did not become ready. Please retry.')
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(`NEXUS: ${error.message}`); process.exitCode = 1 })
}

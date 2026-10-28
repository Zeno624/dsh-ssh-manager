// Host half of the SSH manager: per-session host authorization, agent tools, and
// persistent SSH terminals owned by this plugin.
//
// This file deliberately imports nothing: the profile installs this package as a
// linked workspace directory, so bare package imports of the harness would not
// resolve. Everything goes through Cordis services and Node builtins.
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NAME = 'dsh-ssh-manager'
const STATE_VERSION = 1
const COMMAND = 'ssh-manager'
const API_PATH = '/ssh-manager/api'
const BUFFER_LIMIT = 512 * 1024

function stateDir() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'ssh-manager')
}

function stateFile() {
  return path.join(stateDir(), 'state.json')
}

const ASKPASS = fileURLToPath(new URL('./askpass.exe', import.meta.url))

function passwordRef(host) {
  const key = String(host.id).toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  return 'DSH_SSH_PASSWORD_' + key
}

function loadState() {
  try {
    const raw = fs.readFileSync(stateFile(), 'utf8').replace(/^\uFEFF/, '')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') throw new Error('bad state')
    return {
      version: STATE_VERSION,
      hosts: Array.isArray(parsed.hosts) ? parsed.hosts.filter(hostShape).map(normalizeHost) : [],
      grants: parsed.grants && typeof parsed.grants === 'object' ? parsed.grants : {},
    }
  } catch {
    return { version: STATE_VERSION, hosts: [], grants: {} }
  }
}

function hostShape(host) {
  return host && typeof host === 'object' && typeof host.id === 'string' && typeof host.host === 'string'
}

function normalizeHost(host) {
  const kind = host.kind === 'wsl' ? 'wsl' : 'ssh'
  const port = Number(host.port)
  const rawHost = String(host.host ?? '').trim()
  return {
    id: String(host.id),
    kind,
    name: typeof host.name === 'string' && host.name.trim() !== '' ? host.name.trim() : rawHost,
    host: rawHost,
    user: kind === 'wsl' ? '' : typeof host.user === 'string' ? host.user.trim() : '',
    port: kind === 'wsl' ? 22 : Number.isSafeInteger(port) && port > 0 && port < 65536 ? port : 22,
    group: typeof host.group === 'string' ? host.group.trim() : '',
    note: typeof host.note === 'string' ? host.note.trim() : '',
  }
}

function saveState(state) {
  fs.mkdirSync(stateDir(), { recursive: true })
  const temp = stateFile() + '.tmp'
  fs.writeFileSync(temp, JSON.stringify({ version: STATE_VERSION, hosts: state.hosts, grants: state.grants }, null, 2))
  fs.renameSync(temp, stateFile())
}

function grantsOf(state, agentId) {
  const list = state.grants[agentId]
  return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : []
}

function hostById(state, id) {
  return state.hosts.find((host) => host.id === id)
}

function resolveHost(state, sessionId, ref) {
  const granted = new Set(grantsOf(state, sessionId))
  const host = state.hosts.find((item) => item.id === ref) || state.hosts.find((item) => item.name === ref)
  if (host === undefined) return { error: `没有名为 ${ref} 的主机。先用 ssh_hosts 查看可用主机。` }
  if (!granted.has(host.id)) {
    return { error: `会话未授权主机 ${host.name}。需要在会话右侧栏 SSH 卡片的“agent 授权”里勾选，或权限栏旁的 SSH 选择器里勾选。` }
  }
  return { host }
}

function targetOf(host) {
  if (host.kind === 'wsl') return `${host.host}（本地 WSL）`
  const login = host.user ? `${host.user}@${host.host}` : host.host
  return host.port === 22 ? login : `${login}:${host.port}`
}

function describeHost(host) {
  return `${host.name} (${targetOf(host)})${host.note ? ' — ' + host.note : ''}`
}

function sanitize(text) {
  return String(text)
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[()][A-Za-z0-9]/g, '')
    .replace(/\x1b[=>NOMc]/g, '')
    .replace(/\r/g, '')
}

function tail(text, limit = 12000) {
  if (text.length <= limit) return text
  return '…（已截断）\n' + text.slice(text.length - limit)
}

function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'"
}

function formatBytes(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return String(bytes)
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(1) + ' MB'
}

function sftpQuote(value) {
  return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

function safeRemotePath(value) {
  const text = String(value ?? '')
  if (text === '' || text.includes('\0') || text.includes('\n') || text.includes('\r')) return undefined
  return text.startsWith('/') ? text : '/' + text
}

const FAILURE = /(Permission denied|Connection refused|Connection timed out|Host key verification failed|No route to host|Could not resolve hostname|Network is unreachable|Connection closed by)/i

function textOutput() {
  return {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: { text: { type: 'string', description: 'Human-readable result.' } },
      required: ['text'],
    },
    render(_args, value) {
      return [{ type: 'text', text: String(value.text ?? '') }]
    },
  }
}

function tool(name, description, properties, required, run) {
  return {
    name,
    description,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties,
      ...(required.length > 0 ? { required } : {}),
    },
    output: textOutput(),
    async execute(args, exec) {
      const agent = exec.agent
      if (agent === undefined) throw new Error(`${name} 需要在一个会话里调用`)
      return { text: await run(args, exec, agent) }
    },
  }
}

export const name = NAME
export const inject = ['tools', 'webServer', 'subprocess', 'workingDirectory', 'credentials']

export function apply(ctx) {
  const state = loadState()
  /** @type {Map<string, Map<string, any>>} agentId -> hostId -> session */
  const sessions = new Map()
  const sockets = new Map()
  let counter = 0

  const logger = ctx.logger ?? console
  let rpcCalls = 0

  function rpcLog(line) {
    try {
      fs.mkdirSync(stateDir(), { recursive: true })
      const file = path.join(stateDir(), 'rpc.log')
      let existing = ''
      try { existing = fs.readFileSync(file, 'utf8') } catch {}
      const lines = existing.split('\n').filter(Boolean)
      lines.push(line)
      while (lines.length > 200) lines.shift()
      fs.writeFileSync(file, lines.join('\n') + '\n')
    } catch {}
  }

  function save() {
    try {
      saveState(state)
    } catch (error) {
      logger.error?.(`[${NAME}] state save failed: ${String(error)}`)
    }
  }

  function ownedSessions(agentId) {
    let map = sessions.get(agentId)
    if (map === undefined) {
      map = new Map()
      sessions.set(agentId, map)
    }
    return map
  }

  function sessionOf(agentId, ref) {
    const map = sessions.get(agentId)
    if (map === undefined) return undefined
    if (map.has(ref)) return map.get(ref)
    for (const session of map.values()) if (session.id === ref) return session
    return undefined
  }

  function sessionHostFor(agentId, host) {
    const map = sessions.get(agentId)
    return map?.get(host.id)
  }

  function trimSession(session) {
    if (session.buffer.length <= BUFFER_LIMIT) return
    const cut = session.buffer.slice(session.buffer.length - BUFFER_LIMIT)
    const newline = cut.indexOf('\n')
    session.buffer = newline >= 0 ? cut.slice(newline + 1) : cut
  }

  function noteOutput(session, chunk) {
    session.buffer += chunk
    trimSession(session)
    session.lastAt = Date.now()
    if (session.wake !== undefined) {
      const wake = session.wake
      session.wake = undefined
      wake()
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function waitSettled(session, fromIndex, options = {}) {
    const quietMs = options.quietMs ?? 600
    const minMs = options.minMs ?? 200
    const timeoutMs = options.timeoutMs ?? 30000
    const started = Date.now()
    for (;;) {
      const output = session.buffer.slice(fromIndex)
      const quietFor = Date.now() - session.lastAt
      if (session.exited) return { output, exited: true }
      if (output.length > 0 && Date.now() - started >= minMs && quietFor >= quietMs) return { output, exited: false }
      if (FAILURE.test(sanitize(output))) return { output, exited: false }
      if (Date.now() - started >= timeoutMs) return { output, exited: false, timeout: true }
      await sleep(60)
    }
  }

  async function resolveSsh(signal) {
    try {
      return await ctx.subprocess.resolveExecutable('ssh', undefined, signal)
    } catch {
      const fallback = 'C:\\Windows\\System32\\OpenSSH\\ssh.exe'
      if (fs.existsSync(fallback)) return fallback
      throw new Error('当前执行环境找不到 ssh 客户端')
    }
  }

  async function resolveSftp(signal) {
    try {
      return await ctx.subprocess.resolveExecutable('sftp', undefined, signal)
    } catch {
      const fallback = 'C:\\Windows\\System32\\OpenSSH\\sftp.exe'
      if (fs.existsSync(fallback)) return fallback
      throw new Error('当前执行环境找不到 sftp 客户端')
    }
  }

  // --- local WSL -------------------------------------------------------------

  const distroCache = { at: 0, entries: [] }

  function wslFallback() {
    const root = process.env.SystemRoot || 'C:\\Windows'
    const exe = path.join(root, 'System32', 'wsl.exe')
    return fs.existsSync(exe) ? exe : undefined
  }

  async function resolveWsl(signal) {
    try {
      return await ctx.subprocess.resolveExecutable('wsl', undefined, signal)
    } catch {
      const fallback = wslFallback()
      if (fallback !== undefined) return fallback
      throw new Error('当前执行环境找不到 wsl.exe（需要 Windows 上的 WSL）')
    }
  }

  /** Parse `wsl -l -v` output (WSL_UTF8=1): `* Ubuntu    Stopped         2`. */
  function parseWslList(text) {
    const lines = String(text).replace(/\r/g, '').split('\n')
    const out = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed === '' || /^NAME\b/.test(trimmed)) continue
      const isDefault = trimmed.startsWith('*')
      const body = isDefault ? trimmed.slice(1).trim() : trimmed
      const parts = body.split(/\s{2,}/).filter((part) => part !== '')
      if (parts.length < 2) continue
      const name = parts[0]
      const version = Number(parts[2] ?? 0)
      out.push({
        name,
        state: parts[1],
        version: Number.isFinite(version) ? version : 0,
        default: isDefault,
      })
    }
    return out
  }

  async function readWslDistros(signal) {
    const wsl = await resolveWsl(signal)
    let handle
    try {
      handle = ctx.subprocess.spawn({
        argv: [wsl, '-l', '-v'],
        cwd: process.cwd(),
        stdio: { stdin: 'ignore', stdout: { maxBytes: 256 * 1024 }, stderr: { maxBytes: 64 * 1024 } },
        graceMs: 5000,
        signal,
        env: { WSL_UTF8: '1' },
      })
    } catch (error) {
      throw new Error(`无法启动 wsl.exe：${String(error instanceof Error ? error.message : error)}`)
    }
    const outcome = await handle.done
    const stdout = handle.collected.stdout?.readFrom(0)?.text ?? ''
    const stderr = handle.collected.stderr?.readFrom(0)?.text ?? ''
    if (stdout.trim() === '' && stderr.trim() !== '') throw new Error(`读取 WSL 发行版失败：${tail(stderr.trim(), 800)}`)
    if ((outcome?.exitCode ?? 0) !== 0 && stdout.trim() === '') throw new Error(`读取 WSL 发行版失败（exit=${outcome?.exitCode ?? '?'}）`)
    return parseWslList(stdout)
  }

  async function distrosFor(signal, force = false) {
    const now = Date.now()
    if (!force && now - distroCache.at < 15000) return distroCache.entries
    const entries = await readWslDistros(signal)
    distroCache.at = now
    distroCache.entries = entries
    return entries
  }

  function wslBase(wsl, distro) {
    return [wsl, '-d', distro, '--cd', '~', '--']
  }

  /** Run one bash script inside a WSL distribution (UTF-8 output, home cwd). */
  async function runWsl(host, script, signal, options = {}) {
    const wsl = await resolveWsl(signal)
    const argv = [...wslBase(wsl, host.host), 'bash', '-lc', script]
    let handle
    try {
      handle = ctx.subprocess.spawn({
        argv,
        cwd: process.cwd(),
        stdio: {
          stdin: options.stdin === undefined ? 'ignore' : { data: options.stdin },
          stdout: { maxBytes: options.maxBytes ?? 4 * 1024 * 1024 },
          stderr: { maxBytes: 256 * 1024 },
        },
        graceMs: options.graceMs ?? 2000,
        signal,
        env: { WSL_UTF8: '1' },
      })
    } catch (error) {
      throw new Error(`无法启动 wsl.exe：${String(error instanceof Error ? error.message : error)}`)
    }
    let outcome
    try {
      outcome = await handle.done
    } catch (error) {
      throw new Error(`WSL 执行失败：${String(error instanceof Error ? error.message : error)}`)
    }
    return {
      code: outcome?.exitCode ?? null,
      stdout: handle.collected.stdout?.readFrom(0)?.text ?? '',
      stderr: handle.collected.stderr?.readFrom(0)?.text ?? '',
    }
  }

  /** start / terminate / shutdown / set-default; returns fresh distro list. */
  async function controlDistro(action, distro, signal) {
    if (action !== 'shutdown' && (distro === undefined || distro === '')) throw new Error(`${action} 需要 distro`)
    const wsl = await resolveWsl(signal)
    const args = action === 'start'
      ? [...wslBase(wsl, distro), 'bash', '-lc', 'true']
      : action === 'terminate'
        ? [wsl, '--terminate', distro]
        : action === 'shutdown'
          ? [wsl, '--shutdown']
          : action === 'default'
            ? [wsl, '--set-default', distro]
            : undefined
    if (args === undefined) throw new Error(`未知操作：${action}`)
    let handle
    try {
      handle = ctx.subprocess.spawn({
        argv: args,
        cwd: process.cwd(),
        stdio: { stdin: 'ignore', stdout: { maxBytes: 64 * 1024 }, stderr: { maxBytes: 64 * 1024 } },
        graceMs: action === 'start' ? 120000 : 30000,
        signal,
        env: { WSL_UTF8: '1' },
      })
    } catch (error) {
      throw new Error(`无法启动 wsl.exe：${String(error instanceof Error ? error.message : error)}`)
    }
    const outcome = await handle.done
    const stderr = handle.collected.stderr?.readFrom(0)?.text ?? ''
    if ((outcome?.exitCode ?? 1) !== 0) {
      throw new Error(`WSL ${action} 失败：${tail(stderr.trim() || `exit=${outcome?.exitCode ?? '?'}`, 800)}`)
    }
    return distrosFor(signal, true)
  }

  function distroViews(distros) {
    const added = new Map(
      state.hosts
        .filter((host) => host.kind === 'wsl' && typeof host.host === 'string')
        .map((host) => [host.host, host.id]),
    )
    return distros.map((distro) => ({
      ...distro,
      hostId: added.get(distro.name),
    }))
  }

  function sshArgs(host, hasPassword) {
    const args = hasPassword
      ? ['-o', 'PreferredAuthentications=publickey,password,keyboard-interactive', '-o', 'NumberOfPasswordPrompts=1', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ServerAliveInterval=30']
      : ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ServerAliveInterval=30']
    if (host.port !== 22) args.push('-p', String(host.port))
    return args
  }

  async function getPassword(host) {
    try {
      const credentials = ctx.get('credentials')
      if (credentials === undefined) return undefined
      const resolved = await credentials.resolve(passwordRef(host))
      return resolved && typeof resolved.value === 'string' && resolved.value !== '' ? resolved.value : undefined
    } catch (error) {
      return undefined
    }
  }

  function askpassEnv(password) {
    return {
      SSH_ASKPASS: ASKPASS,
      SSH_ASKPASS_REQUIRE: 'force',
      DISPLAY: ':0',
      DSH_SSH_ASKPASS_VALUE: password,
    }
  }

  function loginOf(host) {
    return host.user ? `${host.user}@${host.host}` : host.host
  }

  /** Run one non-interactive command and collect stdout/stderr/exit code. */
  async function runRemote(host, script, signal) {
    if (host.kind === 'wsl') return runWsl(host, script, signal)
    const ssh = await resolveSsh(signal)
    const password = await getPassword(host)
    const argv = [ssh, ...sshArgs(host, password !== undefined), loginOf(host), script]
    let handle
    try {
      handle = ctx.subprocess.spawn({
        argv,
        cwd: process.cwd(),
        stdio: { stdin: 'ignore', stdout: { maxBytes: 4 * 1024 * 1024 }, stderr: { maxBytes: 256 * 1024 } },
        graceMs: 2000,
        signal,
        ...(password === undefined ? {} : { env: askpassEnv(password) }),
      })
    } catch (error) {
      throw new Error(`无法启动 ssh：${String(error instanceof Error ? error.message : error)}`)
    }
    let outcome
    try {
      outcome = await handle.done
    } catch (error) {
      throw new Error(`ssh 执行失败：${String(error instanceof Error ? error.message : error)}`)
    }
    const stdout = handle.collected.stdout?.readFrom(0)
    const stderr = handle.collected.stderr?.readFrom(0)
    return {
      code: outcome?.exitCode ?? null,
      stdout: stdout?.text ?? '',
      stderr: stderr?.text ?? '',
    }
  }

  const statusCache = new Map()

  async function probeStatus(host, force = false) {
    const cached = statusCache.get(host.id)
    const now = Date.now()
    if (!force && cached !== undefined && now - cached.at < 30000) return cached.online
    if (host.kind === 'wsl') {
      const entries = await distrosFor(undefined, force).catch(() => [])
      const entry = entries.find((item) => item.name === host.host)
      const online = entry !== undefined && entry.state === 'Running'
      statusCache.set(host.id, { at: now, online })
      return online
    }
    const online = await new Promise((resolve) => {
      const socket = net.connect({ host: host.host, port: host.port })
      let settled = false
      const done = (value) => {
        if (settled) return
        settled = true
        socket.destroy()
        resolve(value)
      }
      socket.setTimeout(1500, () => done(false))
      socket.once('connect', () => done(true))
      socket.once('error', () => done(false))
    })
    statusCache.set(host.id, { at: now, online })
    return online
  }

  async function statusesFor(hosts, signal, force = false) {
    const entries = await Promise.all(hosts.map(async (host) => [host.id, await probeStatus(host, force)]))
    signal?.throwIfAborted?.()
    return Object.fromEntries(entries)
  }

  function parseNulRecords(stdout) {
    const fields = stdout.split('\0')
    const records = []
    for (let index = 0; index + 4 < fields.length; index += 5) {
      records.push({
        type: fields[index] === 'd' ? 'directory' : fields[index] === 'f' ? 'file' : fields[index] === 'l' ? 'link' : 'other',
        name: fields[index + 1],
        size: Number(fields[index + 2]),
        mtime: Number(fields[index + 3]),
        mode: fields[index + 4],
      })
    }
    return records
  }

  async function listRemote(host, remotePath, signal) {
    const p = safeRemotePath(remotePath)
    if (p === undefined) throw new Error('非法路径')
    const script = `LC_ALL=C; if [ ! -e ${shellQuote(p)} ]; then echo __DSH_MISSING__; exit 2; fi; if [ -d ${shellQuote(p)} ]; then find ${shellQuote(p)} -maxdepth 1 -mindepth 1 -printf '%y\\0%f\\0%s\\0%T@\\0%m\\0' 2>/dev/null; else echo __DSH_FILE__; fi`
    const result = await runRemote(host, script, signal)
    if (result.stdout.includes('__DSH_MISSING__')) throw new Error(`远程路径不存在：${p}`)
    if (result.stdout.includes('__DSH_FILE__')) return { path: p, kind: 'file', entries: [] }
    if (result.code !== 0 && result.stderr.trim() !== '') {
      throw new Error(`列目录失败：${tail(result.stderr.trim(), 1000)}`)
    }
    const entries = parseNulRecords(result.stdout).filter((entry) => entry.name !== '' && entry.name !== '.' && entry.name !== '..')
    entries.sort((a, b) => (a.type === 'directory' ? 0 : 1) - (b.type === 'directory' ? 0 : 1) || a.name.localeCompare(b.name))
    return { path: p, kind: 'directory', entries }
  }

  async function statRemote(host, remotePath, signal) {
    const p = safeRemotePath(remotePath)
    if (p === undefined) throw new Error('非法路径')
    const script = `stat -c '%F|%s|%Y|%a|%U|%G' -- ${shellQuote(p)} 2>/dev/null || echo __DSH_MISSING__`
    const result = await runRemote(host, script, signal)
    if (result.stdout.includes('__DSH_MISSING__') || result.stdout.trim() === '') throw new Error(`远程路径不存在：${p}`)
    const fields = result.stdout.trim().split('|')
    return {
      path: p,
      kind: fields[0],
      size: Number(fields[1]),
      mtime: Number(fields[2]) * 1000,
      mode: fields[3],
      owner: fields[4],
      group: fields[5],
    }
  }

  async function readRemote(host, remotePath, maxBytes, signal) {
    const limit = Math.max(1024, Math.min(512 * 1024, Number(maxBytes) || 64 * 1024))
    const p = safeRemotePath(remotePath)
    if (p === undefined) throw new Error('非法路径')
    const script = `if [ ! -f ${shellQuote(p)} ]; then echo __DSH_NOTFILE__; exit 3; fi; size=$(stat -c %s -- ${shellQuote(p)} 2>/dev/null || echo 0); if [ "${'$'}size" -gt ${limit} ]; then echo "__DSH_TRUNCATED__"; fi; head -c ${limit + 1} -- ${shellQuote(p)}`
    const result = await runRemote(host, script, signal)
    if (result.stdout.includes('__DSH_NOTFILE__')) throw new Error(`不是普通文件：${p}`)
    const truncated = result.stdout.includes('__DSH_TRUNCATED__')
    const text = result.stdout.replace('__DSH_TRUNCATED__', '')
    const binary = text.includes('\0')
    return { path: p, text: binary ? '' : text, truncated, binary, bytes: Buffer.byteLength(text, 'utf8') }
  }

  async function downloadRemote(host, remotePath, localDir, signal) {
    const p = safeRemotePath(remotePath)
    if (p === undefined) throw new Error('非法路径')
    const name = path.basename(p) || 'remote-file'
    const dir = localDir
    fs.mkdirSync(dir, { recursive: true })
    let target = path.join(dir, name)
    if (fs.existsSync(target)) {
      const ext = path.extname(name)
      const stem = name.slice(0, name.length - ext.length)
      let index = 1
      while (fs.existsSync(target)) {
        target = path.join(dir, `${stem}-${index}${ext}`)
        index += 1
      }
    }
    const cap = 2 * 1024 * 1024
    const script = `if [ ! -f ${shellQuote(p)} ]; then echo __DSH_NOTFILE__; exit 3; fi; size=$(stat -c %s -- ${shellQuote(p)} 2>/dev/null || echo 0); if [ "$size" -gt ${cap} ]; then echo __DSH_TOOBIG__; exit 4; fi; base64 -- ${shellQuote(p)}`
    const result = await runRemote(host, script, signal)
    if (result.stdout.includes('__DSH_NOTFILE__')) throw new Error(`不是普通文件：${p}`)
    if (result.stdout.includes('__DSH_TOOBIG__')) throw new Error(`文件超过 ${formatBytes(cap)}，暂不支持下载`)
    const encoded = result.stdout.replace(/\s+/g, '')
    const bytes = Buffer.from(encoded, 'base64')
    if (bytes.length === 0) throw new Error(`下载失败：${tail((result.stderr || '').trim(), 800) || '空文件或读取失败'}`)
    fs.writeFileSync(target, bytes)
    return { path: p, localPath: target, bytes: bytes.length }
  }

  async function uploadRemote(host, localFile, remoteTarget, signal) {
    const target = safeRemotePath(remoteTarget)
    if (target === undefined) throw new Error('非法远程路径')
    const bytes = fs.readFileSync(localFile)
    if (bytes.length > 2 * 1024 * 1024) throw new Error('文件超过 2 MB，暂不支持上传')
    const encoded = bytes.toString('base64')
    const remoteDir = path.posix.dirname(target)
    const script = `mkdir -p -- ${shellQuote(remoteDir)} && base64 -d > ${shellQuote(target)} && echo __DSH_OK__`
    if (host.kind === 'wsl') {
      const result = await runWsl(host, script, signal, {
        stdin: encoded,
        maxBytes: 256 * 1024,
        graceMs: 30000,
      })
      if (!result.stdout.includes('__DSH_OK__')) {
        throw new Error(`上传失败：${tail(result.stderr.trim(), 1000) || '远端命令未确认'}`)
      }
      return { remotePath: target, localPath: localFile, bytes: bytes.length }
    }
    const password = await getPassword(host)
    const ssh = await resolveSsh(signal)
    const argv = [ssh, ...sshArgs(host, password !== undefined), loginOf(host), script]
    let handle
    try {
      handle = ctx.subprocess.spawn({
        argv,
        cwd: process.cwd(),
        stdio: { stdin: { data: encoded }, stdout: { maxBytes: 256 * 1024 }, stderr: { maxBytes: 256 * 1024 } },
        graceMs: 30000,
        signal,
        ...(password === undefined ? {} : { env: askpassEnv(password) }),
      })
    } catch (error) {
      throw new Error(`无法启动 ssh：${String(error instanceof Error ? error.message : error)}`)
    }
    await handle.done.catch((error) => {
      throw new Error(`上传失败：${String(error instanceof Error ? error.message : error)}`)
    })
    const stdout = handle.collected.stdout?.readFrom(0)?.text ?? ''
    const stderr = handle.collected.stderr?.readFrom(0)?.text ?? ''
    if (!stdout.includes('__DSH_OK__')) throw new Error(`上传失败：${tail(stderr.trim(), 1000) || '远端命令未确认'}`)
    return { remotePath: target, localPath: localFile, bytes: bytes.length }
  }

  async function openSession(agent, host, signal) {
    const existing = sessionHostFor(agent.id, host)
    if (existing !== undefined) {
      if (!existing.exited) return existing
      sessions.get(agent.id)?.delete(host.id)
    }
    const cwd = process.cwd()
    let argv
    let env
    if (host.kind === 'wsl') {
      argv = [await resolveWsl(signal), '-d', host.host, '--cd', '~']
      env = { WSL_UTF8: '1' }
    } else {
      const ssh = await resolveSsh(signal)
      const password = await getPassword(host)
      argv = [ssh, '-tt', ...sshArgs(host, password !== undefined)]
      argv.push(host.user ? `${host.user}@${host.host}` : host.host)
      env = password === undefined ? undefined : askpassEnv(password)
    }
    const handle = await ctx.subprocess.spawnTerminal({
      argv,
      cwd,
      rows: 40,
      cols: 120,
      terminalType: 'xterm-256color',
      shellActivity: true,
      graceMs: 2000,
      signal,
      ...(env === undefined ? {} : { env }),
    })
    counter += 1
    const session = {
      id: `${host.kind === 'wsl' ? 'wsl' : 'ssh'}-${counter}`,
      agent: agent.id,
      host,
      handle,
      buffer: '',
      lastAt: Date.now(),
      exited: false,
      busy: false,
      wake: undefined,
    }
    handle.output.setEncoding('utf8')
    handle.output.on('data', (chunk) => noteOutput(session, chunk))
    handle.output.on('error', (error) => noteOutput(session, `\n[output error] ${String(error)}\n`))
    handle.done.then((outcome) => {
      session.exited = true
      noteOutput(session, `\n[ssh 会话已结束 exit=${outcome?.exitCode ?? '?'}]\n`)
    }, (error) => {
      session.exited = true
      noteOutput(session, `\n[ssh 会话失败] ${String(error)}\n`)
    })
    ownedSessions(agent.id).set(host.id, session)
    sockets.set(session.id, handle)

    const ready = await waitSettled(session, 0, { quietMs: 700, minMs: 300, timeoutMs: 20000 })
    // A fast auth/host-key failure can land just after the first quiet window; give
    // the connection attempt one more beat before trusting the session.
    await sleep(500)
    const output = sanitize(session.buffer)
    if (session.exited || FAILURE.test(output)) {
      try { await handle.terminate() } catch {}
      sessions.get(agent.id)?.delete(host.id)
      sockets.delete(session.id)
      throw new Error(`连接 ${describeHost(host)} 失败：\n${tail(output || ready.output, 4000)}`)
    }
    return session
  }

  async function sendToSession(session, text, submit, timeoutMs) {
    if (session.busy) throw new Error('该会话正在执行上一条命令，请稍后')
    if (session.exited) throw new Error('该 SSH 会话已经结束，请重新 ssh_open')
    session.busy = true
    try {
      const from = session.buffer.length
      await session.handle.write(submit === false ? text : text + '\r')
      const settled = await waitSettled(session, from, { quietMs: 700, minMs: 250, timeoutMs: timeoutMs ?? 30000 })
      return settled
    } finally {
      session.busy = false
    }
  }

  function listForAgent(agent) {
    const map = sessions.get(agent.id)
    if (map === undefined) return []
    return [...map.values()].map((session) => ({
      session: session.id,
      host: session.host.id,
      name: session.host.name,
      target: targetOf(session.host),
      state: session.exited ? 'exited' : 'running',
    }))
  }

  function allowedHosts(agent) {
    const granted = new Set(grantsOf(state, agent.id))
    return state.hosts.filter((host) => granted.has(host.id))
  }

  function sessionWorkspace(agent) {
    try {
      const workingDirectory = ctx.get('workingDirectory')
      if (workingDirectory !== undefined && agent?.session !== undefined) return workingDirectory.get(agent.session)
    } catch {}
    return process.cwd()
  }

  async function hostViews() {
    const needsDistros = state.hosts.some((host) => host.kind === 'wsl')
    const distros = needsDistros ? await distrosFor(undefined, false).catch(() => []) : []
    return Promise.all(state.hosts.map(async (host) => {
      const view = {
        ...host,
        target: targetOf(host),
        hasPassword: host.kind === 'wsl' ? false : (await getPassword(host)) !== undefined,
      }
      if (host.kind === 'wsl') {
        const entry = distros.find((item) => item.name === host.host)
        view.state = entry === undefined ? 'Unknown' : entry.state
        view.online = entry !== undefined && entry.state === 'Running'
      }
      return view
    }))
  }

  // --- RPC: shared by the HTTP bridge (the Client UI's data channel) --------
  function commandResult(payload) {
    return { kind: 'success', text: JSON.stringify(payload) }
  }

  async function handleInvocation(invocation) {
      const raw = String(invocation.rawInput ?? '').trim()
      const body = raw.startsWith('/' + COMMAND) ? raw.slice(COMMAND.length + 1).trim() : raw
      let payload
      try {
        payload = body === '' ? {} : JSON.parse(body)
      } catch {
        return { kind: 'error', text: 'ssh-manager expects a JSON payload' }
      }
      const agentId = invocation.agent?.id
      if (typeof agentId !== 'string') return { kind: 'error', text: 'ssh-manager requires an agent session' }
      const op = String(payload.op ?? '')
      rpcCalls += 1
      rpcLog(`${new Date().toISOString()} op=${op} agent=${agentId} raw=${body.slice(0, 200)}`)
      try {
        if (op === 'state') {
          const granted = grantsOf(state, agentId)
          return commandResult({
            hosts: await hostViews(),
            grants: granted,
            sessions: listForAgent(invocation.agent),
          })
        }
        if (op === 'wsl.discover') {
          const distros = await distrosFor(invocation.signal, true)
          return commandResult({ distros: distroViews(distros) })
        }
        if (op === 'wsl.control') {
          const action = String(payload.action ?? '')
          const distro = payload.distro === undefined || payload.distro === null ? undefined : String(payload.distro)
          const distros = await controlDistro(action, distro, invocation.signal)
          return commandResult({
            distros: distroViews(distros),
            hosts: await hostViews(),
            grants: grantsOf(state, agentId),
          })
        }
        if (op === 'host.upsert') {
          const input = payload.host && typeof payload.host === 'object' ? payload.host : {}
          const host = normalizeHost({
            id: typeof input.id === 'string' && input.id !== '' ? input.id : `h-${Date.now().toString(36)}`,
            kind: input.kind,
            name: input.name,
            host: String(input.host ?? ''),
            user: input.user,
            port: input.port,
            group: input.group,
            note: input.note,
          })
          if (host.host === '') return { kind: 'error', text: host.kind === 'wsl' ? 'WSL 发行版不能为空' : '主机地址不能为空' }
          if (host.kind === 'wsl') {
            const duplicate = state.hosts.find((item) => item.id !== host.id && item.kind === 'wsl' && item.host === host.host)
            if (duplicate !== undefined) return { kind: 'error', text: `发行版 ${host.host} 已经加入主机列表了` }
            const known = await distrosFor(invocation.signal, true).catch(() => [])
            if (known.length > 0 && !known.some((item) => item.name === host.host)) {
              return { kind: 'error', text: `本机没有名为 ${host.host} 的 WSL 发行版` }
            }
          }
          const index = state.hosts.findIndex((item) => item.id === host.id)
          if (index >= 0) state.hosts[index] = host
          else state.hosts.push(host)
          save()
          return commandResult({ hosts: await hostViews(), grants: grantsOf(state, agentId) })
        }
        if (op === 'host.remove') {
          const id = String(payload.id ?? '')
          const removed = hostById(state, id)
          state.hosts = state.hosts.filter((host) => host.id !== id)
          for (const grants of Object.values(state.grants)) {
            if (Array.isArray(grants)) {
              const filtered = grants.filter((item) => item !== id)
              grants.length = 0
              grants.push(...filtered)
            }
          }
          if (removed !== undefined) {
            try {
              const credentials = ctx.get('credentials')
              if (credentials !== undefined) await credentials.unset(passwordRef(removed))
            } catch (error) {}
          }
          save()
          return commandResult({ hosts: await hostViews(), grants: grantsOf(state, agentId) })
        }
        if (op === 'grants.set') {
          const requested = Array.isArray(payload.hosts) ? payload.hosts.filter((id) => typeof id === 'string') : []
          const known = new Set(state.hosts.map((host) => host.id))
          const next = [...new Set(requested.filter((id) => known.has(id)))]
          const previous = new Set(grantsOf(state, agentId))
          const started = []
          const failures = []
          // Authorizing a local WSL host starts it right away: the session picker
          // is the only place the user should need to act.
          for (const id of next) {
            if (previous.has(id)) continue
            const host = hostById(state, id)
            if (host === undefined || host.kind !== 'wsl') continue
            try {
              const distros = await distrosFor(invocation.signal, true)
              const entry = distros.find((item) => item.name === host.host)
              if (entry !== undefined && entry.state === 'Running') continue
              await controlDistro('start', host.host, invocation.signal)
              started.push(host.name)
            } catch (error) {
              failures.push({
                host: host.name,
                message: String(error instanceof Error ? error.message : error),
              })
            }
          }
          state.grants[agentId] = next
          save()
          return commandResult({ hosts: await hostViews(), grants: next, started, failures })
        }
        if (op === 'status') {
          const ids = Array.isArray(payload.ids) ? payload.ids.filter((id) => typeof id === 'string') : undefined
          const targets = ids === undefined ? state.hosts : state.hosts.filter((host) => ids.includes(host.id))
          const statuses = await statusesFor(targets, invocation.signal, true)
          return commandResult({ statuses })
        }
        if (op.startsWith('files.')) {
          const hostId = String(payload.hostId ?? '')
          const granted = new Set(grantsOf(state, agentId))
          const host = hostById(state, hostId)
          if (host === undefined) return { kind: 'error', text: `没有这个主机：${hostId}` }
          if (!granted.has(host.id)) return { kind: 'error', text: `会话未授权主机 ${host.name}，先在会话栏勾选` }
          const signal = invocation.signal
          if (op === 'files.ls') return commandResult(await listRemote(host, payload.path, signal))
          if (op === 'files.stat') return commandResult(await statRemote(host, payload.path, signal))
          if (op === 'files.read') return commandResult(await readRemote(host, payload.path, payload.maxBytes, signal))
          if (op === 'files.download') {
            const workspace = sessionWorkspace(invocation.agent)
            return commandResult(await downloadRemote(host, payload.path, workspace, signal))
          }
          if (op === 'files.upload') {
            const workspace = sessionWorkspace(invocation.agent)
            const localRaw = String(payload.localPath ?? '')
            const local = path.resolve(workspace, localRaw)
            if (local !== workspace && !local.startsWith(workspace + path.sep)) {
              return { kind: 'error', text: '只能上传工作区内的文件' }
            }
            if (!fs.existsSync(local)) return { kind: 'error', text: `本地文件不存在：${local}` }
            const remotePath = String(payload.remotePath ?? '')
            return commandResult(await uploadRemote(host, local, remotePath, signal))
          }
          if (op === 'files.mkdir') {
            const p = safeRemotePath(payload.path)
            if (p === undefined) return { kind: 'error', text: '非法路径' }
            const result = await runRemote(host, `mkdir -p -- ${shellQuote(p)} && echo __DSH_OK__`, signal)
            if (!result.stdout.includes('__DSH_OK__')) return { kind: 'error', text: `新建目录失败：${tail(result.stderr.trim(), 800)}` }
            return commandResult({ path: p })
          }
          if (op === 'files.rename') {
            const from = safeRemotePath(payload.path)
            const to = safeRemotePath(payload.to)
            if (from === undefined || to === undefined) return { kind: 'error', text: '非法路径' }
            const result = await runRemote(host, `mv -- ${shellQuote(from)} ${shellQuote(to)} && echo __DSH_OK__`, signal)
            if (!result.stdout.includes('__DSH_OK__')) return { kind: 'error', text: `重命名失败：${tail(result.stderr.trim(), 800)}` }
            return commandResult({ from, to })
          }
          if (op === 'files.remove') {
            const p = safeRemotePath(payload.path)
            if (p === undefined || p === '/') return { kind: 'error', text: '非法路径' }
            const result = await runRemote(host, `rm -rf -- ${shellQuote(p)} && echo __DSH_OK__`, signal)
            if (!result.stdout.includes('__DSH_OK__')) return { kind: 'error', text: `删除失败：${tail(result.stderr.trim(), 800)}` }
            return commandResult({ path: p })
          }
          return { kind: 'error', text: `unknown file operation: ${op}` }
        }
        return { kind: 'error', text: `unknown ssh-manager operation: ${op}` }
      } catch (error) {
        return { kind: 'error', text: String(error instanceof Error ? error.message : error) }
      }
  }

  // --- HTTP bridge: the Client UI's data channel ---------------------------
  // Using the plugin's own route keeps UI calls out of the session log; the
  // command bridge used to append an invisible command row on every click.
  function isLoopbackRequest(request) {
    const address = request?.socket?.remoteAddress
    if (address !== undefined && address !== null && address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') {
      return false
    }
    const host = String(request?.headers?.host ?? '')
    if (host === '') return true
    try {
      const hostname = new URL('http://' + host).hostname
      return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]' || hostname === '::1'
    } catch {
      return false
    }
  }

  function readJsonBody(request, limit) {
    return new Promise((resolve, reject) => {
      const chunks = []
      let size = 0
      let settled = false
      const fail = (error) => {
        if (settled) return
        settled = true
        reject(error)
      }
      request.on('data', (chunk) => {
        if (settled) return
        size += chunk.length
        if (size > limit) {
          fail(new Error('内容过大'))
          if (typeof request.resume === 'function') request.resume()
          return
        }
        chunks.push(chunk)
      })
      request.on('end', () => {
        if (settled) return
        settled = true
        resolve(Buffer.concat(chunks).toString('utf8'))
      })
      request.on('error', fail)
      request.on('aborted', () => fail(new Error('请求已中断')))
    })
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: API_PATH,
    handler: async (request, response) => {
      const send = (status, payload) => {
        if (response.headersSent || response.writableEnded) return
        response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        response.end(JSON.stringify(payload))
      }
      try {
        if (!isLoopbackRequest(request)) return send(403, { ok: false, error: '仅允许本机访问' })
        if (String(request.method ?? 'GET').toUpperCase() !== 'POST') return send(200, { ok: false, error: '只接受 POST 请求' })
        const raw = await readJsonBody(request, 2 * 1024 * 1024)
        let payload
        try {
          payload = raw === '' ? {} : JSON.parse(raw)
        } catch {
          return send(200, { ok: false, error: '请求不是合法 JSON' })
        }
        const sessionId = String(payload.sessionId ?? '')
        if (sessionId === '') return send(200, { ok: false, error: '缺少 sessionId' })
        const agents = ctx.get('agents')
        const agent = (agents !== undefined && typeof agents.get === 'function' ? agents.get(sessionId) : undefined) ?? { id: sessionId }
        const outcome = await handleInvocation({ rawInput: JSON.stringify(payload), agent })
        if (outcome !== undefined && outcome.kind === 'error') {
          return send(200, { ok: false, error: String(outcome.text ?? '操作失败') })
        }
        const data = outcome !== undefined && typeof outcome.text === 'string' && outcome.text !== '' ? JSON.parse(outcome.text) : {}
        return send(200, { ok: true, ...data })
      } catch (error) {
        return send(200, { ok: false, error: String(error instanceof Error ? error.message : error) })
      }
    },
  }))

  // --- tools ---------------------------------------------------------------
  ctx.tools.register(tool(
    'ssh_hosts',
    'List the hosts the user has authorized for this session (remote SSH or local WSL), with connection state. Call this before using other host tools.',
    {},
    [],
    async (_args, _exec, agent) => {
      const hosts = allowedHosts(agent)
      if (hosts.length === 0) {
        return '本会话尚无已授权的主机（SSH 或本地 WSL）。请让用户在会话右侧栏的 SSH 卡片，或输入框权限栏旁的 SSH 选择器中勾选主机。'
      }
      const rows = hosts.map((host) => `- ${host.id}: ${describeHost(host)}`)
      const active = listForAgent(agent)
      const running = active.length === 0 ? '' : '\n\n已打开的会话:\n' + active.map((item) => `- ${item.session}: ${item.name} (${item.target}) ${item.state}`).join('\n')
      return '已授权主机:\n' + rows.join('\n') + running
    },
  ))

  ctx.tools.register(tool(
    'wsl_list',
    'List the local WSL distributions on this Windows machine, with running state, version, default flag, and whether each one is already added to the host list.',
    {},
    [],
    async (_args, exec) => {
      const distros = await distrosFor(exec.signal, true)
      if (distros.length === 0) return '本机没有已注册的 WSL 发行版。'
      const added = new Map(
        state.hosts.filter((host) => host.kind === 'wsl').map((host) => [host.host, host.id]),
      )
      return distros
        .map((distro) => {
          const flags = [distro.default ? '默认' : '', added.has(distro.name) ? `已加入主机 ${added.get(distro.name)}` : '未加入主机']
            .filter(Boolean)
            .join('，')
          return `- ${distro.name}: ${distro.state}（WSL ${distro.version}）${flags ? ' · ' + flags : ''}`
        })
        .join('\n')
    },
  ))

  ctx.tools.register(tool(
    'wsl_control',
    'Manage a local WSL distribution: start it, terminate it, set it as the default distribution, or shut down all of WSL.',
    {
      action: { type: 'string', enum: ['start', 'terminate', 'shutdown', 'default'], description: 'Operation to perform.' },
      distro: { type: 'string', description: 'Distribution name from wsl_list (not needed for shutdown).' },
    },
    ['action'],
    async (args, exec) => {
      const action = String(args.action ?? '')
      const distro = args.distro === undefined ? undefined : String(args.distro)
      const distros = await controlDistro(action, distro, exec.signal)
      const rows = distros.map((item) => `- ${item.name}: ${item.state}${item.default ? '（默认）' : ''}`).join('\n')
      return `WSL ${action}${distro ? ' ' + distro : ''} 完成。\n${rows}`
    },
  ))

  ctx.tools.register(tool(
    'ssh_open',
    'Open (or reuse) a persistent SSH terminal session to an authorized host. The session keeps cd, environment and running programs across later tool calls.',
    {
      host: { type: 'string', description: 'Host id or name from ssh_hosts.' },
    },
    ['host'],
    async (args, exec, agent) => {
      const resolved = resolveHost(state, agent.id, String(args.host ?? ''))
      if (resolved.error !== undefined) throw new Error(resolved.error)
      const session = await openSession(agent, resolved.host, exec.signal)
      const output = sanitize(session.buffer)
      if (FAILURE.test(output)) throw new Error(`连接 ${describeHost(resolved.host)} 失败：\n${tail(output, 6000)}`)
      return `已打开 ${describeHost(resolved.host)}，会话 ${session.id}${session.exited ? '（已退出）' : ''}\n初始输出:\n${tail(output, 4000)}`
    },
  ))

  ctx.tools.register(tool(
    'ssh_send',
    'Send one command to a persistent SSH session and wait for the remote prompt to go quiet. Prefer one command per call so output stays readable.',
    {
      session: { type: 'string', description: 'Session id from ssh_open or ssh_list.' },
      text: { type: 'string', description: 'Command text to type.' },
      submit: { type: 'boolean', description: 'Append Enter (default true).' },
      timeoutMs: { type: 'integer', description: 'Wait bound in milliseconds (default 30000).' },
    },
    ['session', 'text'],
    async (args, _exec, agent) => {
      const session = sessionOf(agent.id, String(args.session ?? ''))
      if (session === undefined) throw new Error('没有这个 SSH 会话，先用 ssh_open 打开或用 ssh_list 查看')
      const settled = await sendToSession(session, String(args.text ?? ''), args.submit !== false, Number(args.timeoutMs) || undefined)
      const output = sanitize(settled.output)
      if (FAILURE.test(output)) throw new Error(`命令在 ${describeHost(session.host)} 上失败：\n${tail(output, 6000)}`)
      const status = settled.exited ? '会话已结束' : settled.timeout ? '等待超时（命令可能仍在运行）' : '完成'
      return `${status}\n${settled.output.length === 0 ? '（无输出）' : tail(output)}`
    },
  ))

  ctx.tools.register(tool(
    'ssh_run',
    'Open or reuse a session for an authorized host, run one command, and return its output.',
    {
      host: { type: 'string', description: 'Host id or name from ssh_hosts.' },
      command: { type: 'string', description: 'Command to run on the remote host.' },
      timeoutMs: { type: 'integer', description: 'Wait bound in milliseconds (default 30000).' },
    },
    ['host', 'command'],
    async (args, exec, agent) => {
      const resolved = resolveHost(state, agent.id, String(args.host ?? ''))
      if (resolved.error !== undefined) throw new Error(resolved.error)
      const session = await openSession(agent, resolved.host, exec.signal)
      const settled = await sendToSession(session, String(args.command ?? ''), true, Number(args.timeoutMs) || undefined)
      const output = sanitize(settled.output)
      if (FAILURE.test(output)) throw new Error(`命令在 ${describeHost(resolved.host)} 上失败：\n${tail(output, 6000)}`)
      const status = settled.exited ? '会话已结束' : settled.timeout ? '等待超时（命令可能仍在运行）' : '完成'
      return `${session.id} @ ${describeHost(resolved.host)}: ${status}\n${tail(output)}`
    },
  ))

  ctx.tools.register(tool(
    'ssh_read',
    'Read retained output from a persistent SSH session without sending input.',
    {
      session: { type: 'string', description: 'Session id from ssh_open or ssh_list.' },
      lines: { type: 'integer', description: 'Number of trailing lines to return (default 80).' },
    },
    ['session'],
    async (args, _exec, agent) => {
      const session = sessionOf(agent.id, String(args.session ?? ''))
      if (session === undefined) throw new Error('没有这个 SSH 会话')
      const count = Math.max(1, Math.min(1000, Number(args.lines) || 80))
      const lines = sanitize(session.buffer).split('\n')
      return tail(lines.slice(Math.max(0, lines.length - count)).join('\n'), 20000)
    },
  ))

  ctx.tools.register(tool(
    'ssh_list',
    'List the persistent SSH sessions this agent currently owns.',
    {},
    [],
    async (_args, _exec, agent) => {
      const list = listForAgent(agent)
      if (list.length === 0) return '当前没有打开的 SSH 会话。'
      return list.map((item) => `- ${item.session}: ${item.name} (${item.target}) ${item.state}`).join('\n')
    },
  ))

  ctx.tools.register(tool(
    'ssh_close',
    'Close one persistent SSH session and end its remote connection.',
    { session: { type: 'string', description: 'Session id from ssh_list.' } },
    ['session'],
    async (args, _exec, agent) => {
      const session = sessionOf(agent.id, String(args.session ?? ''))
      if (session === undefined) throw new Error('没有这个 SSH 会话')
      try { await session.handle.terminate() } catch {}
      sessions.get(agent.id)?.delete(session.host.id)
      sockets.delete(session.id)
      return `已关闭会话 ${session.id}（${describeHost(session.host)}）`
    },
  ))

  ctx.tools.register(tool(
    'ssh_ls',
    'List one directory on an authorized remote host. Returns entries with type, size and mtime. Use "/" as the path for the remote root.',
    {
      host: { type: 'string', description: 'Host id or name from ssh_hosts.' },
      path: { type: 'string', description: 'Absolute remote directory path, default "/".' },
    },
    ['host'],
    async (args, exec, agent) => {
      const resolved = resolveHost(state, agent.id, String(args.host ?? ''))
      if (resolved.error !== undefined) throw new Error(resolved.error)
      const listing = await listRemote(resolved.host, args.path === undefined ? '/' : args.path, exec.signal)
      if (listing.kind === 'file') return `${listing.path} 是文件，不是目录；用 ssh_read_file 读取。`
      const lines = listing.entries.map((entry) => {
        const type = entry.type === 'directory' ? 'd' : entry.type === 'link' ? 'l' : '-'
        const date = Number.isFinite(entry.mtime) ? new Date(entry.mtime * 1000).toISOString().replace('T', ' ').slice(0, 19) : ''
        return `${type} ${String(entry.size).padStart(10)} ${date} ${entry.name}${entry.type === 'directory' ? '/' : ''}`
      })
      return `${describeHost(resolved.host)}:${listing.path}\n${lines.length === 0 ? '（空目录）' : lines.join('\n')}`
    },
  ))

  ctx.tools.register(tool(
    'ssh_read_file',
    'Read a text file from an authorized remote host. Use it for logs and source files; the result is truncated at maxBytes.',
    {
      host: { type: 'string', description: 'Host id or name from ssh_hosts.' },
      path: { type: 'string', description: 'Absolute remote file path.' },
      maxBytes: { type: 'integer', description: 'Read bound in bytes (default 65536, max 524288).' },
    },
    ['host', 'path'],
    async (args, exec, agent) => {
      const resolved = resolveHost(state, agent.id, String(args.host ?? ''))
      if (resolved.error !== undefined) throw new Error(resolved.error)
      const file = await readRemote(resolved.host, args.path, args.maxBytes, exec.signal)
      if (file.binary) return `${file.path} 看起来是二进制文件（${file.bytes} 字节），不直接返回内容。`
      const header = `${describeHost(resolved.host)}:${file.path}${file.truncated ? '（已截断）' : ''}`
      return `${header}\n${file.text}`
    },
  ))

  ctx.tools.register(tool(
    'ssh_stat',
    'Show metadata (type, size, mtime, mode, owner) for one remote path on an authorized host.',
    {
      host: { type: 'string', description: 'Host id or name from ssh_hosts.' },
      path: { type: 'string', description: 'Absolute remote path.' },
    },
    ['host', 'path'],
    async (args, exec, agent) => {
      const resolved = resolveHost(state, agent.id, String(args.host ?? ''))
      if (resolved.error !== undefined) throw new Error(resolved.error)
      const info = await statRemote(resolved.host, args.path, exec.signal)
      return `${describeHost(resolved.host)}:${info.path}\n类型: ${info.kind}\n大小: ${info.size} 字节\n修改时间: ${new Date(info.mtime).toISOString()}\n权限: ${info.mode}\n属主: ${info.owner}:${info.group}`
    },
  ))

  ctx.tools.register(tool(
    'ssh_download',
    'Download one remote file from an authorized host into the current session workspace, so later file/read tools can use the local copy.',
    {
      host: { type: 'string', description: 'Host id or name from ssh_hosts.' },
      path: { type: 'string', description: 'Absolute remote file path.' },
    },
    ['host', 'path'],
    async (args, exec, agent) => {
      const resolved = resolveHost(state, agent.id, String(args.host ?? ''))
      if (resolved.error !== undefined) throw new Error(resolved.error)
      const workspace = sessionWorkspace(agent)
      const saved = await downloadRemote(resolved.host, args.path, workspace, exec.signal)
      return `已下载 ${describeHost(resolved.host)}:${saved.path} → ${saved.localPath}`
    },
  ))

  ctx.effect(() => async () => {
    const all = [...sockets.values()]
    sockets.clear()
    sessions.clear()
    await Promise.allSettled(all.map((handle) => handle.terminate()))
  }, 'ssh-manager.sessions')
}

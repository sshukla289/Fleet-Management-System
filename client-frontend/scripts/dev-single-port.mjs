import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(clientRoot, '..')
const envFile = path.join(repoRoot, '.env')
const viteBin = path.join(clientRoot, 'node_modules', 'vite', 'bin', 'vite.js')

function readFrontendPort() {
  if (process.env.FRONTEND_PORT) {
    const fromProcess = Number.parseInt(process.env.FRONTEND_PORT, 10)
    if (Number.isFinite(fromProcess) && fromProcess > 0) {
      return fromProcess
    }
  }

  if (fs.existsSync(envFile)) {
    const envLines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/)
    for (const line of envLines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.startsWith('FRONTEND_PORT=')) {
        continue
      }

      const value = trimmed.slice('FRONTEND_PORT='.length).trim()
      const parsed = Number.parseInt(value, 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed
      }
    }
  }

  return 5173
}

function log(message) {
  process.stdout.write(`[dev-single-port] ${message}\n`)
}

function warn(message) {
  process.stderr.write(`[dev-single-port] ${message}\n`)
}

function runCommand(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()

    server.once('error', (error) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
        resolve(false)
        return
      }

      resolve(false)
    })

    server.listen({ host: '127.0.0.1', port }, () => {
      server.close(() => resolve(true))
    })
  })
}

async function waitForPortState(port, shouldBeFree, attempts = 20, delayMs = 500) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const free = await isPortFree(port)
    if (free === shouldBeFree) {
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  return false
}

function listDockerContainersPublishingPort(port) {
  try {
    const output = runCommand('docker', ['ps', '--filter', `publish=${port}`, '--format', '{{.ID}}|{{.Names}}'])
      .trim()

    if (!output) {
      return []
    }

    return output
      .split(/\r?\n/)
      .map((line) => {
        const [id, name] = line.split('|')
        return { id: id?.trim(), name: name?.trim() }
      })
      .filter((container) => container.id)
  } catch (error) {
    return []
  }
}

function stopDockerContainers(containers) {
  if (!containers.length) {
    return false
  }

  const names = containers.map((container) => container.name || container.id).join(', ')
  log(`Stopping Docker container(s) using the frontend port: ${names}`)
  runCommand('docker', ['stop', ...containers.map((container) => container.id)], { cwd: repoRoot })
  return true
}

function listListeningPids(port) {
  if (process.platform === 'win32') {
    const output = runCommand('netstat', ['-ano', '-p', 'tcp'])
    const pids = new Set()

    for (const rawLine of output.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line.startsWith('TCP')) {
        continue
      }

      const columns = line.split(/\s+/)
      if (columns.length < 5) {
        continue
      }

      const localAddress = columns[1]
      const state = columns[3]
      const pid = Number.parseInt(columns[4], 10)

      if (state === 'LISTENING' && localAddress.endsWith(`:${port}`) && Number.isFinite(pid)) {
        pids.add(pid)
      }
    }

    return [...pids]
  }

  try {
    const output = runCommand('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']).trim()
    if (!output) {
      return []
    }

    return output
      .split(/\r?\n/)
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value))
  } catch (error) {
    return []
  }
}

function getProcessLabel(pid) {
  try {
    if (process.platform === 'win32') {
      const output = runCommand('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']).trim()
      if (!output || output.startsWith('INFO:')) {
        return `PID ${pid}`
      }

      const firstColumn = output.split(',')[0]
      return `${firstColumn.replace(/^"|"$/g, '')} (PID ${pid})`
    }

    const output = runCommand('ps', ['-p', String(pid), '-o', 'comm=']).trim()
    return output ? `${output} (PID ${pid})` : `PID ${pid}`
  } catch (error) {
    return `PID ${pid}`
  }
}

function stopProcesses(pids) {
  if (!pids.length) {
    return
  }

  for (const pid of pids) {
    const label = getProcessLabel(pid)
    log(`Stopping process using the frontend port: ${label}`)

    if (process.platform === 'win32') {
      runCommand('taskkill', ['/PID', String(pid), '/T', '/F'])
      continue
    }

    runCommand('kill', ['-TERM', String(pid)])
  }
}

async function freePort(port) {
  if (await isPortFree(port)) {
    return
  }

  const dockerContainers = listDockerContainersPublishingPort(port)
  if (stopDockerContainers(dockerContainers)) {
    const releasedByDocker = await waitForPortState(port, true)
    if (releasedByDocker) {
      return
    }
  }

  const pids = listListeningPids(port)
  if (!pids.length) {
    throw new Error(`Port ${port} is busy, but no owning process could be identified.`)
  }

  stopProcesses(pids)

  const releasedByPidKill = await waitForPortState(port, true)
  if (!releasedByPidKill) {
    throw new Error(`Port ${port} is still busy after stopping the conflicting process.`)
  }
}

async function main() {
  const port = readFrontendPort()
  await freePort(port)

  const viteArgs = [viteBin, ...process.argv.slice(2)]
  const child = spawn(process.execPath, viteArgs, {
    cwd: clientRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      FRONTEND_PORT: String(port),
    },
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 0)
  })

  for (const eventName of ['SIGINT', 'SIGTERM']) {
    process.on(eventName, () => {
      if (!child.killed) {
        child.kill(eventName)
      }
    })
  }
}

main().catch((error) => {
  warn(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

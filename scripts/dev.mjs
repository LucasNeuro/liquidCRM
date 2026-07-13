import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

const children = []

function run(command, args, name) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  })

  child.on('exit', (code, signal) => {
    console.log(`[dev] ${name} encerrou (code=${code}, signal=${signal})`)
    shutdown(code ?? 1)
  })

  children.push(child)
  return child
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  process.exit(code)
}

function waitForPort(port, host = '127.0.0.1', timeoutMs = 15000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = createServer()
        .once('error', () => {
          // porta em uso = proxy já subiu
          resolve(true)
        })
        .once('listening', () => {
          socket.close(() => {
            if (Date.now() - started > timeoutMs) {
              reject(new Error(`Timeout aguardando porta ${port}`))
              return
            }
            setTimeout(tryConnect, 200)
          })
        })
        .listen(port, host)
    }
    tryConnect()
  })
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log('[dev] subindo playbooks Gemini + Vite...')
run('npm', ['run', 'ai'], 'playbooks')

const port = Number(process.env.AI_PROXY_PORT || 8787)

waitForPort(port)
  .then(() => {
    run('npx', ['vite'], 'vite')
  })
  .catch((err) => {
    console.error('[dev]', err.message)
    // sobe o Vite mesmo se o wait falhar
    run('npx', ['vite'], 'vite')
  })

/**
 * Fails with a clear error if port 3001 is already in use.
 * Run before start:demo to prevent the demo backend from silently losing
 * to an already-running normal backend.
 */

import net from 'node:net'

const PORT = 3001

// Attempt a TCP connection — succeeds only if something is already listening.
const inUse = await new Promise<boolean>((resolve) => {
  const sock = net.createConnection({ port: PORT, host: '127.0.0.1' })
  sock.once('connect', () => { sock.destroy(); resolve(true) })
  sock.once('error', () => resolve(false))
})

if (inUse) {
  console.error(
    `\nError: port ${PORT} is already in use.\n` +
    `Stop the running backend first:  npm run stop\n` +
    `Then retry:                       npm run start:demo\n`
  )
  process.exit(1)
}

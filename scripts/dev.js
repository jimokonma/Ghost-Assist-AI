/**
 * Dev launcher — deletes ELECTRON_RUN_AS_NODE from process.env before
 * spawning electron-vite, so the variable is absent throughout the entire
 * electron-vite → Electron child process chain.
 *
 * Background: ELECTRON_RUN_AS_NODE=1 is set by VS Code extensions (and
 * Claude Code) to run scripts with Electron's bundled Node.js. When set,
 * Electron skips initialising its API layer, so require('electron') returns
 * the binary path string instead of { app, BrowserWindow, ... }.
 */

delete process.env.ELECTRON_RUN_AS_NODE

const { spawn } = require('child_process')
const path = require('path')

const isWindows = process.platform === 'win32'
const npx = isWindows ? 'npx.cmd' : 'npx'

const child = spawn(npx, ['electron-vite', 'dev'], {
  stdio: 'inherit',
  shell: true,   // Required on Windows for .cmd executables
  env: process.env,
  cwd: path.join(__dirname, '..')
})

child.on('exit', (code) => process.exit(code ?? 0))

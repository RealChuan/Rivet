import { spawn } from 'node:child_process'

const command = process.platform === 'win32' ? 'electron-forge.cmd' : 'electron-forge'
const child = spawn(command, ['start'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, NODE_OPTIONS: '--enable-source-maps' },
})
child.on('exit', (code) => process.exit(code ?? 0))

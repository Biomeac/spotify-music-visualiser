// Builds the real Mac app for this machine and opens it. The packaged app has its own name and
// permissions, which macOS needs for "React to the music" (System Audio Recording).
import { execFileSync } from 'node:child_process'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

if (process.platform !== 'darwin') {
  console.log('npm run app builds the Mac app, so it only works on a Mac.')
  process.exit(1)
}
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', shell: false })
run('npx', ['electron-vite', 'build'])
run('npx', ['electron-builder', '--mac', 'dir', `--${process.arch}`, '--publish', 'never'])
const dirs = readdirSync('dist').filter((d) => d.startsWith('mac'))
for (const d of dirs) {
  const app = join('dist', d, 'Lyrics Visualiser.app')
  if (existsSync(app)) {
    console.log(`\nOpening ${app}. Drag it into Applications to keep it.`)
    run('open', [app])
    process.exit(0)
  }
}
console.error('Built, but could not find the app in dist/.')
process.exit(1)

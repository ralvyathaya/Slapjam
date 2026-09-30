// Zip the *contents* of dist/ (index.html at archive root) for itch.io HTML5 upload.
// Pure Node: no zip dependency, works the same on Windows, macOS and Linux.
import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { crc32, deflateRawSync } from 'node:zlib'

const root = resolve('dist')
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
const out = resolve('artifacts', `castledown-itch-v${pkg.version}.zip`)

async function walk(dir) {
  const files = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await walk(path))
    else if (entry.isFile()) files.push(path)
  }
  return files.sort()
}

function dosTime(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

const files = await walk(root).catch(() => [])
if (!files.some(file => relative(root, file) === 'index.html')) {
  console.error('dist/index.html not found. Run `npm run build` first.')
  process.exit(1)
}

const locals = [], centrals = []
let offset = 0
for (const file of files) {
  // itch.io serves from a case-sensitive CDN; zip entries must use forward slashes.
  const name = Buffer.from(relative(root, file).split(sep).join('/'), 'utf8')
  const data = await readFile(file)
  const deflated = deflateRawSync(data, { level: 9 })
  const stored = deflated.length >= data.length
  const body = stored ? data : deflated
  const crc = crc32(data) >>> 0
  const { time, date } = dosTime((await stat(file)).mtime)

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6)
  local.writeUInt16LE(stored ? 0 : 8, 8); local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12)
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22)
  local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28)
  locals.push(local, name, body)

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6)
  central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(stored ? 0 : 8, 10)
  central.writeUInt16LE(time, 12); central.writeUInt16LE(date, 14); central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24)
  central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42)
  centrals.push(central, name)
  offset += local.length + name.length + body.length
}

const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10)
end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16)

await mkdir(resolve('artifacts'), { recursive: true })
const zip = Buffer.concat([...locals, ...centrals, end])
await writeFile(out, zip)
if (files.length > 1000) console.warn('Warning: itch.io allows at most 1000 files per HTML5 upload.')
console.log(`Packed ${files.length} files → ${relative(process.cwd(), out)} (${(zip.length / 1024 / 1024).toFixed(2)} MB)`)
console.log('Upload as "HTML", tick "This file will be played in the browser", viewport 720 × 1280, enable mobile friendly + fullscreen button.')

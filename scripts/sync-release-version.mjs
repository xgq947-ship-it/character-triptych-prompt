import { readFile, writeFile } from 'node:fs/promises'

const rawTag = process.env.GITHUB_REF_NAME || process.argv[2] || ''
const version = rawTag.replace(/^v/, '')

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error('Expected a semantic version tag such as v0.1.0')
}

async function updateJson(path, mutate) {
  const value = JSON.parse(await readFile(path, 'utf8'))
  mutate(value)
  await writeFile(path, JSON.stringify(value, null, 2) + '\n')
}

await updateJson('package.json', (value) => {
  value.version = version
})

await updateJson('package-lock.json', (value) => {
  value.version = version
  if (value.packages?.['']) value.packages[''].version = version
})

await updateJson('src-tauri/tauri.conf.json', (value) => {
  value.version = version
})

const cargoPath = 'src-tauri/Cargo.toml'
const cargo = await readFile(cargoPath, 'utf8')
await writeFile(
  cargoPath,
  cargo.replace(
    /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+(")/,
    '$1' + version + '$2',
  ),
)

console.log('Synced release version ' + version)

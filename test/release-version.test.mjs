import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('release versions stay synchronized in source files', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
  const tauriConfig = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8'))
  const cargo = await readFile('src-tauri/Cargo.toml', 'utf8')
  const cargoVersion = cargo.match(/\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)?.[1]
  assert.equal(packageJson.version, tauriConfig.version)
  assert.equal(packageJson.version, cargoVersion)
})

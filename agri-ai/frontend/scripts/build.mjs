import { build } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
await build({root, configFile:path.join(root,'vite.config.js')})

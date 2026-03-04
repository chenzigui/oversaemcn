/**
 * 打包 Lumi Browser Relay 扩展，并对 JS 进行混淆。
 * 输出到 dist/chrome-extension/
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const srcDir = join(root, 'assets', 'chrome-extension')
const outDir = join(root, 'dist', 'chrome-extension')

let JavaScriptObfuscator
try {
  const mod = await import('javascript-obfuscator')
  JavaScriptObfuscator = mod.default
} catch {
  console.error('请先安装: pnpm add -D javascript-obfuscator')
  process.exit(1)
}

const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: false,
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: false,
  stringArray: true,
  stringArrayCallsTransform: false,
  stringArrayEncoding: [],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersType: 'variable',
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false,
  reservedNames: [
    'chrome', 'fetch', 'crypto', 'WebSocket', 'document', 'window',
    'deriveRelayToken', 'fetchGatewayConfig', 'buildRelayWsUrl',
    'reconnectDelayMs', 'isRetryableReconnectError',
    'classifyRelayCheckResponse', 'classifyRelayCheckException',
  ],
  reservedStrings: ['./background-utils.js', './options-validation.js'],
}

function obfuscate(filePath) {
  const code = readFileSync(filePath, 'utf8')
  const result = JavaScriptObfuscator.obfuscate(code, obfuscatorOptions)
  return result.getObfuscatedCode()
}

mkdirSync(outDir, { recursive: true })

// 复制 manifest、html、icons
cpSync(join(srcDir, 'manifest.json'), join(outDir, 'manifest.json'))
cpSync(join(srcDir, 'options.html'), join(outDir, 'options.html'))
if (existsSync(join(srcDir, 'icons'))) {
  mkdirSync(join(outDir, 'icons'), { recursive: true })
  cpSync(join(srcDir, 'icons'), join(outDir, 'icons'), { recursive: true })
}

// 混淆 JS（保留 import 路径，使用 preserveImportExportMode）
const jsFiles = [
  'background-utils.js',
  'options-validation.js',
  'options.js',
  'background.js',
]
for (const name of jsFiles) {
  const srcPath = join(srcDir, name)
  if (!existsSync(srcPath)) continue
  const obfuscated = obfuscate(srcPath)
  writeFileSync(join(outDir, name), obfuscated)
}

console.log('打包完成:', outDir)

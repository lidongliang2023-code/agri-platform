/**
 * 移动端 H5 预览服务的探活与自启。

 *
 * <p>为什么单独抽出来：本机的后台进程会被系统回收（实测一个会话里掉过多次），
 * 而移动端 e2e 依赖 `npm run dev:h5`。让**每个脚本自己确保服务在跑**，
 * 比"先手动起、再祈祷它别掉"可靠得多。</p>
 */
import { spawn } from 'node:child_process'

/**
 * 探活 H5 dev server。
 *
 * @param port 端口
 * @returns 可达返回 true
 */
export async function isMobileDevServerUp(port = 5300) {
  try {
    const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

/**
 * 确保 H5 dev server 可用：已在跑直接返回；没跑就 detached 起一个并轮询等待。
 *
 * @param options.root 小程序工程目录（含 package.json）
 * @param options.port 端口，默认 5300
 * @param options.timeoutMs 最长等待
 * @returns 最终是否可用
 */
export async function ensureMobileDevServer({ root, port = 5300, timeoutMs = 45000 } = {}) {
  if (await isMobileDevServerUp(port)) return true
  const isWin = process.platform === 'win32'
  try {
    // Windows 上 Node 20+ 不许不带 shell 执行 .cmd（EINVAL），显式走 cmd /c；
    // cwd 通过 spawn 选项传，不拼进命令行，避免中文路径被转义搞坏。
    const proc = spawn(
      isWin ? 'cmd.exe' : 'npm',
      isWin ? ['/c', 'npm run dev:h5'] : ['run', 'dev:h5'],
      { cwd: root, detached: true, stdio: 'ignore', windowsHide: true, shell: false },
    )
    proc.unref()
  } catch {
    return false
  }
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    if (await isMobileDevServerUp(port)) return true
  }
  return false
}

import { defineConfig } from 'vitest/config'

/**
 * `@agri/shared` 的单测与覆盖率门禁配置。
 *
 * <p><b>为什么测试放 `tests/` 而不是 `src/`：</b>应用侧 `tsconfig.json` 的 `include` 只有
 * `src`，但共享包内的测试要 `import { it } from 'vitest'`。若把测试混进 `src/`，任何以
 * `src` 为根的编译（含编辑器与未来的包级 tsc）都要去解析 vitest 类型；分开放可以避免
 * 测试依赖污染生产编译面。</p>
 *
 * <p><b>门禁口径：</b>V2.0 第 4.8 节要求覆盖率不低于 80%。此处把阈值写进配置，
 * 低于阈值 vitest 直接以非 0 退出码结束，因此 `pnpm test:coverage` 本身即卡点，
 * 不依赖是否已有 CI。</p>
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      // 未被测试直接 import 的源文件也纳入统计，避免“少测一个文件反而分数更高”。
      all: true,
      thresholds: {
        // 按文件卡门禁。原因：本包 19 个源文件里 15 个是纯类型声明，编译后不产生任何
        // 可执行语句，v8 会直接按 100% 呈现 —— 若只看全局均值，新增一个 0 覆盖率的
        // 逻辑文件也会被这 15 个“自动满分”文件稀释掉。perFile 让每一个真正含逻辑的
        // 文件都必须自己达标。
        perFile: true,
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})

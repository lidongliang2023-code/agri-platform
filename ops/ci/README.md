# 统一门禁

一条命令跑完全部检查，本地与 CI 用的是同一份实现（`verify.mjs`）。

## 为什么要有它

在此之前这些验证全靠人手一条条敲：跑单测、查 workspace 成员是否还在、`nginx -t`、抽查发布产物，
换个人或换一天就可能漏一项。门禁的价值不在于"能跑"，而在于**跑不到就不算完成**。

## 本地怎么跑

```powershell
node ops/ci/verify.mjs                 # 快速组：workspace / shared / gateway / bucket
node ops/ci/verify.mjs --build         # 追加逐个子系统前端的构建（慢，默认关）
node ops/ci/verify.mjs --only gateway  # 只跑某一组
node ops/ci/verify.mjs --skip shared   # 跳过某一组（CI 里单独跑 shared）
```

## 各检查组做什么

| 组 | 检查内容 | 判据 |
| :-- | :-- | :-- |
| `workspace` | `pnpm-workspace.yaml` 登记的成员是否都存在 | 缺失且**已入库** → 失败；缺失但未入库 → 提示（CI 里本就没有） |
| `shared` | 共享包单测 + 覆盖率 | `test:coverage` 退出码 0（perFile ≥80%） |
| `gateway` | `nginx -t` 校验 `ops/gateway/conf/nginx.conf` | 配置可加载；无 nginx 或无非 ASCII 前缀时跳过并说明 |
| `bucket` | 发布产物完整性：指针 → 版本目录 → index.html 引用的资源 | 三者一致才通过；专门盯"指针切过去了、资源却 404"的白屏发布 |
| `apps`（`--build`） | 逐个前端工程跑它自己的 build | 退出码 0 |
| `font` | 可见文字的最小字号（端清单取自 `publish.mjs` 注册表，不发版的旧目录不算） | 任何 `font-size` 低于 12px（uni-app 低于 24rpx）即失败；`pages.json` 的 `tabBar` 没写 `fontSize`（uni-app 缺省 10px）也算失败 |

## CI 的已知边界（不是配置疏漏，是依赖顺序）

CI 检出的是**已入库**的内容。下列目录此前"未纳入版本控制"，本条说明就是照那个状态写的；
现在它们已经在库里（`git ls-files` 实测 agri-master-data 521、agri-s2b2c 364、agri-finance 148 个文件），
所以覆盖面已经扩大，`workspace` 组与 `--build` 会自动带上它们：

```
agri-master-data/  agri-finance/  agri-s2b2c/        # 已入库（2026-11-03 复核）
```

因此仍然需要注意的两点：

- 共享包**脱离 workspace 单独安装**（`--ignore-workspace`）这条做法先保留：它是在成员缺失的年代定下的，
  改成走根 install 需要单独验一次 CI runner 上的中文路径与 pnpm 包装脚本问题，不属于字号这一轮。
- 各子系统的 `target/`、`dist/` 仍有历史遗留被跟踪（`agri-*/backend/target`），
  它们会进 CI 检出、拖慢构建，是否移出版本控制需要一个单独的决定。

也就是说：**这份门禁的覆盖面受限于版本库的覆盖面**。子系统目录入库越早，被守住的就越多。

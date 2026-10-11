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

## CI 的已知边界（不是配置疏漏，是依赖顺序）

CI 检出的是**已入库**的内容，而下列目录目前尚未纳入版本控制：

```
agri-master-data/  agri-finance/  agri-s2b2c/        # 以及 agri-iot/ agri-trade/ 的在途改动
```

因此：

- CI **不跑根目录 `pnpm install`** —— workspace 文件登记了这些成员，成员不在就会安装失败；
  改为让共享包脱离 workspace 单独安装（`--ignore-workspace`，本地已实测 43 个用例照跑）。
- CI **不校验**这些子系统前端的构建与接入 —— 它们入库后会被 `workspace` 组与 `--build` 自动覆盖，
  不需要改这份流水线。

也就是说：**这份门禁的覆盖面受限于版本库的覆盖面**。子系统目录入库越早，被守住的就越多。

# 移动端 UI V1.0 页面检查记录

## 2026-11-21 生产管理小程序 false 提示与协议状态修复

针对从快捷登录入口切换到短信页后出现的 `false` 提示和协议状态残留，修复共享登录状态与生产管理登录模板：

- 登录方式切换、返回登录入口时清理协议错误、页面抖动和 Toast，避免上一页面的未勾选状态带到短信页。
- 勾选协议后立即清理错误状态、抖动和 Toast；协议校验逻辑保持不变，默认仍未勾选。
- 去掉生产管理小程序登录页复选控件上的动态 `aria-checked` 绑定及带括号的协议点击表达式，保留 `role="checkbox"`、圆形选中视觉和原有协议点击区域，避免运行时把布尔状态或事件表达式显示成 `false`。
- 未恢复第三方登录区域；生产管理小程序短信页继续不显示微信、支付宝、政务服务平台入口。Logo、名称、副标题、接口、权限和 AppID 未改变。

验证结果：生产管理小程序 `typecheck` 和 `build:mp-weixin` 均退出0；构建产物扫描确认没有动态 `aria-checked`、`toggleAgree()` 表达式、字面量 `false` 或第三方登录文案。构建过程只有项目原有 Sass 弃用提示。尚未重新在微信开发者工具截图或真机复验，因此本节不将产物扫描表述为实际画面验收。

本次修改共享登录逻辑和生产管理登录页源码、更新生产管理微信小程序构建产物及本记录；未上传微信、发送验证码、提交登录、修改业务数据或 AppID。

## 2026-11-20 生产管理登录页按专用原型调整（本节为最新）

依据用户提供的《农业产业互联网平台_移动端登录页原型_V1.0.html》，修改生产管理 `src/pages/login/login.vue`，不修改共享认证逻辑及其他七端。本节替代下方此前“仅优化小程序、H5/App保持原样”的现状说明。

- 小程序：白底、居中62px品牌图、18px品牌名称，首屏“手机号验证码登录”及注册入口；验证码页可返回入口，不显示密码登录/忘记密码。按胶囊下缘留白，保留短屏滚动与底部安全区。
- H5：绿色渐变品牌横幅、白色20px圆角表单卡，验证码/密码切换；App保留白底品牌与验证码/密码表单、原有首次隐私提示和免登录选项。
- 输入区及主按钮48px、输入字15px、10px圆角；圆形协议标记18px、独立48px点击区，协议默认不勾选。保留倒计时、提交禁用、二次验证、注册、帮助、连接设置和已有登录后跳转。
- 未找到生产管理现有微信取手机号/运营商号码认证适配器，因此未添加假授权或假成功；小程序主入口按可用能力降级为验证码。移除原有待开通第三方按钮。不抄入原型示例公司、备案号、自动注册承诺。

构建与发布：最终H5、小程序、App资源均构建退出0；H5发布器含类型检查，通过。H5当前版本 `20261120-login-prototype-v2`，原入口不变；小程序与App产物分别更新至本工程dist/build/mp-weixin、dist/build/app。保留开发者工具已有测试appid和私有预览配置，未将测试号写入源码manifest。没有上传微信或生成APK/IPA。

验证：第一版H5独立无登录会话检查375×812、320×568无横向溢出，输入框和主按钮48px；验证码/密码切换、未勾选协议提示正常，0脚本异常、0 POST请求。随后依据像素对照修正H5品牌横幅/卡片，并隐藏小程序忘记密码入口；最终三端重构建成功，最终H5截图对照已完成，但修改后没有再验证表单交互和320px窄屏。

原型对照：从用户HTML提取H5外部浏览器.screen为375×812参考图；最终browser_screenshot差异14.4%（43,852 / 304,500像素），初次为33.2%。差异包括生产品牌、业务文案、注册/连接/验证码帮助入口、协议点击区及滚动条；非1:1复刻，不能称逐像素一致。没有对小程序/App做本轮运行截图、真机胶囊/软键盘/实际登录/MFA验收；前轮开发者工具绑定异常本轮未核实。

仅修改生产管理页面、构建/发布产物及两份现有记录；项目外仅创建临时构建与检查文件。未发送验证码、登录、上传或修改业务数据。

## 2026-11-20 生产管理微信小程序登录页专项优化（最新）

本次仅优化 `agri-production/miniprogram/src/pages/login/login.vue` 的微信小程序布局，采用平台分支隔离；不改其他七端、共享登录规则、接口地址及权限。以下记录优先于本文件历史生产管理小程序登录页说明。

- 白底、24px左右留白、深绿生产管理标题；品牌区与表单按层级分开，简化大卡片与装饰。
- 新增长期可见的手机号、短信验证码与二次验证字段标签；输入区56px高、输入文字16px；验证码按钮独立排列。
- 协议确认移至登录按钮之前，勾选行48px、视觉标记20px；用户协议与隐私政策分别使用48px操作区，错误提示在原位持续显示。
- 主按钮56px，明确显示“登录生产管理”、验证中和进入中状态；保留收不到验证码、注册账号/创建主体、服务连接设置。
- 按系统状态栏和微信胶囊实际边界计算顶部留白，底部保留安全区；短屏可滚动，手机号键盘确认可转到验证码输入框。
- 保留小程序短信验证码登录规则与二次验证，不新增密码登录；协议默认未勾选。H5/App继续使用原布局。

### 本次验证

`npm run build:mp-weixin` 与 `npm run typecheck` 最终均退出0；第一次类型检查发现旧分支两个冗余平台判断，修正后重新构建和类型检查通过。编译产物46条注册路由，登录页JS/JSON/WXML/WXSS四类文件齐全，新版布局及样式已编入。编译仅出现既有Sass弃用提示。

使用同一份小程序分支模板与CSS制作临时浏览器布局预览（原生标签转换为HTML，空表单与模拟交互），375×812截图量得白色背景及56px主按钮，按钮处于屏幕下方；注册和连接设置可滚动访问。此预览仅检查版式，不等同微信运行结果，没有与参考设计稿逐像素对比。未发送验证码、未登录、未调用业务提交；未验证开发者工具、真机胶囊、软键盘、弱网与二次验证接口。

正式小程序产物更新至 `agri-production/miniprogram/dist/build/mp-weixin`，未上传微信。生产管理App资源仍为此前17时批次，H5未重新发布；本次为小程序专用分支，H5/App视觉保持原样。其他七端产物未更新。账号及访问地址不变。


## 2026-11-20 17时批次：小程序与 App 同步更新

本节为小程序/App最新编译记录，优先于下方历史“未按收尾源码重编译”说明。基于本次执行时工作区最新源码，已完成8端微信小程序及App资源共16次正式构建，并完成8次类型检查，退出码均为0。未修改业务源码、账号、接口配置、版本号或签名；H5未重新发布。

| 移动端 | 注册页面 | 微信代码包（KiB） | App资源（KiB） | 构建/类型检查 |
|---|---:|---:|---:|---|
| 交易撮合 | 31 | 310.4 | 970.4 | 通过 |
| 生产管理 | 46 | 567.2 | 1183.7 | 通过 |
| 物联网 | 46 | 358.6 | 1066.8 | 通过 |
| 消费者商城 | 34 | 340.7 | 959.4 | 通过 |
| 渠道商工作台 | 22 | 264.0 | 883.6 | 通过 |
| 信息资讯 | 43 | 385.2 | 1002.9 | 通过 |
| 综合服务 | 21 | 286.3 | 900.9 | 通过 |
| 移动执法 | 15 | 198.0 | 830.7 | 通过 |

### 本次检查范围

- 微信注册页面与源码一致，逐页JS/JSON/WXML/WXSS文件齐全；App配置包含全部源码注册路由，各页CSS及核心资源齐全。
- App视图入口为 `uni-app-view.umd.js` 和 `__uniappview.html`。初始检查脚本误按 `app-view.js` 判断，核对实际产物格式后更正，未改动或重编译产品。
- 两类产物均检出48px最小触控样式；这只证明相关样式已编入，不代表每个页面在真机上均合规。
- 编译日志出现Sass legacy JS API与@import弃用提示，没有构建错误。包大小为目录文件字节总和，不是微信上传后压缩包或APK/IPA安装包大小。
- 本次没有开发者工具预览、手机扫码、模拟器/真机运行、后端联调，也没有再次进行H5布局验收。

### 产物与发布边界

本次产物保留在各工程 `dist/build/mp-weixin` 与 `dist/build/app`，不再仅存临时目录。使用 `npm run build:mp-weixin`、`npm run build:app`，随后 `npm run typecheck`；显式指定对应构建输出目录。

- 交易撮合：`agri-trade/miniprogram/dist/build/mp-weixin`；`agri-trade/miniprogram/dist/build/app`。
- 生产管理：`agri-production/miniprogram/dist/build/mp-weixin`；`agri-production/miniprogram/dist/build/app`。
- 物联网：`agri-iot/miniprogram/dist/build/mp-weixin`；`agri-iot/miniprogram/dist/build/app`。
- 消费者商城：`agri-s2b2c/mobile/dist/build/mp-weixin`；`agri-s2b2c/mobile/dist/build/app`。
- 渠道商工作台：`agri-s2b2c/mobile-channel/dist/build/mp-weixin`；`agri-s2b2c/mobile-channel/dist/build/app`。
- 信息资讯：`agri-info/mobile/dist/build/mp-weixin`；`agri-info/mobile/dist/build/app`。
- 综合服务：`agri-service/mobile/dist/build/mp-weixin`；`agri-service/mobile/dist/build/app`。
- 移动执法：`agri-government/mobile/dist/build/mp-weixin`；`agri-government/mobile/dist/build/app`。

仍须完成正式发布配置：6端微信appid为空；交易与物联网仍共用wx1de8bb7dc46fb3a2。App标识仍为项目中自定义的__UNI__AGRI_*值，是否对应DCloud已登记应用未验证。本轮未补齐包名/Bundle ID、签名证书、设备可访问的HTTPS业务及认证地址、微信合法域名。物联网存在wechat模式配置，本次按默认production脚本构建，未使用wechat本地模式。生产存在.env.local，本次沿用构建器默认加载行为；其余工程配置未改，不能据构建成功声称手机可登录。

这些是微信小程序代码包和App资源，不是已上传的微信版本，也不是APK/IPA或App热更新包；未上传第三方平台，未更新已安装手机端。上文历史H5最终补丁未复验等限制保持有效。


## 2026-11-20 收尾修复与复验（本节优先于下方历史记录）

本次修复、构建发布和记录更新已执行。**不能将本次结果表述为“258 页全面验收通过”**：全量路由访问与角色补验已执行，但缺编号直达只验证错误态，部分页面采样时仍在加载；最终 p1 补丁构建成功后未再次进行浏览器尺寸/布局验证。

### 本轮修复与原因

- 商城与渠道商大量跳回登录页：核实为旧检查脚本误把业务档案按 `.data` 读取。业务接口直接返回档案对象；修正测试会话初始化后，34/22 条注册路由均可到达，未修改登录权限或业务会话校验。
- 按规范末尾48×48px验收标准，定点扩大首页/个人中心菜单、资讯铃铛/返回/搜索/筛选/帮助、交易业务入口、生产悬浮操作、物联网错误重试等控件。商城首页分类卡原网格中仍带百分比宽度，已改为占满网格单元。
- 共用登录“我已阅读并同意”文字自身绑定勾选操作，增加48px点击区；勾选圆形图形保留原视觉尺寸。同步发布八端。
- 商城商品详情补齐48px步进器与购物车入口，数量区域允许换行；溯源说明采用不透明白色。请求失败的技术提示改为中文网络/超时说明。
- p1补丁：服务与执法菜单提高尺寸规则优先级，交易商品详情两处快捷操作与资讯文章三处底部操作补齐48px；服务商联系说明补齐热区。
- p1补丁：生产通用业务页滚动标签容器实测395px宽，超出375px屏幕。补齐width/max-width/box-sizing并移除容器内边距，保留标签内容横向滚动。
- 物联网运营采样页无编号直达发出 `/devices/NaN/sampling`。p1增加正整数校验与“返回设备列表”，不再对无效编号发请求；正常采样保存流程未改。

### 发布版本

| 移动端 | 当前版本 | 本轮之前版本（回滚目标） |
|---|---|---|
| 交易撮合 | `20261120-ui-v1-closeout-p1` | `20261120-ui-v1-r9-audit` |
| 生产管理 | `20261120-ui-v1-closeout-p1` | `20261120-ui-v1-r9-audit` |
| 物联网 | `20261120-ui-v1-closeout-p1` | `20261120-ui-v1-r10-audit` |
| 消费者商城 | `20261120-ui-v1-closeout-p1` | `20261120-ui-v1-r9-audit` |
| 渠道商工作台 | `20261120-ui-v1-closeout` | `20261120-ui-v1-r9-audit` |
| 信息资讯 | `20261120-ui-v1-closeout-p1` | `20261120-ui-v1-r10-audit` |
| 综合服务 | `20261120-ui-v1-closeout-p1` | `20261120-ui-v1-r10-audit` |
| 移动执法 | `20261120-ui-v1-closeout-p1` | `20261120-ui-v1-r9-audit` |

本次只发布H5；小程序和App产物仍对应此前编译记录，未按本轮新源码重编译。回滚使用既有发布器 `node ops/gateway/scripts/publish.mjs --app <应用名> --repoint <上表旧版本>`。

### 真实详情与网络恢复

| 场景 | 实际结果 | 限定 |
|---|---|---|
| 交易商品 | 从首页进入商品7090，展示规格、库存和采购操作；无脚本/接口错误 | 两处44px快捷操作已在p1修正，修改后没有再验证 |
| 生产地块 | 从地块列表进入真实编号922089，展示基本信息和农事记录 | 未提交编辑/新增 |
| 物联网设备 | 从设备列表进入设备12，展示遥测、配置和历史回执 | 未发送设备控制指令 |
| 商城商品 | 从分类进入真实商品详情，库存、规格、数量和底部操作正常显示 | 页面自身会记录浏览足迹；未加购物车/下单/收藏 |
| 渠道订单 | 从订单列表进入真实测试订单详情，展示退款状态、商品与金额 | 未处理售后或发货 |
| 资讯文章 | 从资讯列表进入文章1，正文、关联行情、评论和底部操作可见 | 三处底部热区已在p1修正，修改后没有再验证 |
| 综合服务 | 从服务列表进入服务商1，展示项目与预约入口 | 联系文字热区已在p1修正，修改后没有再验证 |
| 服务商接单台 | provider账号正常展示服务商、待接需求和进行中工单，无接口错误 | 未抢单/上报进度 |
| 执法任务详情 | 当前inspector账号列表无任务 | 真实详情未能实测，不视为通过 |
| 商城分类失败恢复 | 拦截商品数据请求模拟断网，显示失败与“重新加载”；解除拦截点击后恢复7件商品，重试入口消失 | 检查针对数据请求失败，并非全设备断网；p1仅将错误文案改为中文，修改后没有再验证 |
| 渠道货架失败恢复 | 拦截货架请求，持续显示错误与“重新加载货架”；解除拦截点击后恢复3件商品 | 未改价格/上下架 |

### 权限、覆盖与最终补丁验证边界

- 农户访问综合服务接单台及专家工作台产生3条403：分别是接单台、专家档案、专家问诊接口。页面有持续错误说明，按角色限制记录；provider接单台已正向验证。未绑定专家账号的正向接诊流程未验证，未放开权限。
- 物联网最终按user/ops工作台分别加载46条路由，登录页因已有会话返回首页，其余业务路由到达；采样缺编号400已在p1修复，修改后没有再验证。
- 交易卖家7条路由补用了独立角色初始化。生产中9条路由转入原生通用业务页，属于路由兼容转发，表中保留实际落点。
- 258条路由访问未捕获页面脚本异常。自动检测零计数只表示当时渲染节点未命中规则，不代表完整视觉合规；未带编号的详情不能算真实内容验收。表中采样仍在加载的页面明确保留状态。
- 正文7:1、辅助文字4.5:1、48px触控、各类空/加载/错误态、渐变/图片背景、所有长文本极值、主色面积、逐像素还原未全部逐项证明；不据自动摘要宣称全部符合63条规范。
- 375×812登录页截图仅为结构抽查；没有把全部页面与设计稿逐像素对比。小程序胶囊避让、App安全区与真机强光未验。
- 最后p1发布覆盖交易、生产、物联网、商城、资讯、服务、执法7端，构建成功；渠道保留closeout已验证版。p1改动没有再做浏览器验证，不能宣称问题全部复测归零。
- 未主动提交订单、支付、发货、发消息、改权限、改设备配置或删除业务数据。阅读页面可能触发系统本身的浏览记录/审计记录；本轮测试明确触发商城浏览足迹，不能称为数据库绝对只读。

### 本轮逐路由访问记录（258条）

以下记录主要对应closeout版本；物联网与交易卖家角色补验单列依据，最终p1补丁状态以上述说明为准。详情没编号时只记录直达表现；不把缺编号错误态算真实详情通过。

| 移动端 | 注册路由 | 实际落点 | 本轮观察 |
|---|---|---|---|
| 交易撮合 | `pages/home/index` | `#/pages/home/index` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/products/index` | `#/pages/products/index` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/product/detail` | `#/pages/product/detail` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/demands/index` | `#/pages/demands/index` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/orders/index` | `#/pages/orders/index` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/profile/index` | `#/pages/profile/index` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/publish-demand/index` | `#/pages/buyer/demand` | 发生跳转，见实际落点；页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/login/index` | `#/` | 发生跳转，见实际落点；页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/match/index` | `#/pages/match/index` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/order-detail/index` | `#/pages/order-detail/index` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/contracts/index` | `#/pages/contracts/index` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/contract-detail/index` | `#/pages/contract-detail/index` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/logistics/index` | `#/pages/logistics/index` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/workspace/index` | `#/pages/workspace/index` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/business/index` | `#/pages/business/index` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/checkout/index` | `#/pages/checkout/index` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/buyer/overview` | `#/pages/buyer/overview` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/buyer/demand` | `#/pages/buyer/demand` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/buyer/inquiry` | `#/pages/buyer/inquiry` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/buyer/after` | `#/pages/buyer/after` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/buyer/fund` | `#/pages/buyer/fund` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/seller/overview` | `#/pages/seller/overview` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/seller/goods` | `#/pages/seller/goods` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/seller/quote` | `#/pages/seller/quote` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/seller/p2t` | `#/pages/seller/p2t` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/seller/customer` | `#/pages/seller/customer` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/seller/fund` | `#/pages/seller/fund` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/collaboration/chat` | `#/pages/collaboration/chat` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/collaboration/agent` | `#/pages/collaboration/agent` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/collaboration/price` | `#/pages/collaboration/price` | 页面已渲染；非完整交互验收 |
| 交易撮合 | `pages/identity/index` | `#/pages/identity/index` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/alerts/review` | `#/pages/alerts/review` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/native/analytics` | `#/pages/native/analytics` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/native/reports` | `#/pages/native/reports` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/native/import` | `#/pages/native/import` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/native/growth-analysis` | `#/pages/native/growth-analysis` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/native/exports` | `#/pages/native/exports` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/login/login` | `#/pages/login/login` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/register/register` | `#/pages/workbench/workbench` | 发生跳转，见实际落点；页面已渲染；非完整交互验收 |
| 生产管理 | `pages/workbench/workbench` | `#/pages/workbench/workbench` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/plots/plots` | `#/pages/plots/plots` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/tasks/tasks` | `#/pages/tasks/tasks` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/harvests/harvests` | `#/pages/harvests/harvests` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/profile/profile` | `#/pages/profile/profile` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/messages/messages` | `#/pages/messages/messages` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/plots/detail` | `#/pages/plots/detail` | 缺参数/编号提示，未验真实详情 |
| 生产管理 | `pages/plots/map` | `#/pages/plots/map` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/plots/map-embed` | `#/pages/plots/map-embed` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/plots/create` | `#/pages/plots/create` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/tasks/detail` | `#/pages/tasks/detail` | 缺参数/编号提示，未验真实详情 |
| 生产管理 | `pages/tasks/create` | `#/pages/tasks/create` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/inputs/scan` | `#/pages/inputs/scan` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/inputs/detail` | `#/pages/inputs/detail` | 缺参数/编号提示，未验真实详情 |
| 生产管理 | `pages/harvests/create` | `#/pages/harvests/create` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/harvests/detail` | `#/pages/harvests/detail` | 缺参数/编号提示，未验真实详情 |
| 生产管理 | `pages/inventory/inventory` | `#/pages/inventory/inventory` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/trace/scan` | `#/pages/trace/scan` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/alerts/alerts` | `#/pages/alerts/alerts` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/ai/pest-detection` | `#/pages/native/business?target=%252Fproduction%252Fai%252Fpest-detection` | 发生跳转，见实际落点；页面已渲染；非完整交互验收；曾测到横向溢出，已p1修正未复验 |
| 生产管理 | `pages/ai/prescription` | `#/pages/native/business?target=%252Fproduction%252Fai%252Finput-safety` | 发生跳转，见实际落点；页面已渲染；非完整交互验收；曾测到横向溢出，已p1修正未复验 |
| 生产管理 | `pages/ai/assistant` | `#/pages/native/assistant` | 发生跳转，见实际落点；页面已渲染；非完整交互验收 |
| 生产管理 | `pages/ai/remote-sensing` | `#/pages/native/business?target=%252Fproduction%252Fgrowth` | 发生跳转，见实际落点；页面已渲染；非完整交互验收；曾测到横向溢出，已p1修正未复验 |
| 生产管理 | `pages/ai/alerts` | `#/pages/native/business?target=%252Fproduction%252Falerts` | 发生跳转，见实际落点；页面已渲染；非完整交互验收；曾测到横向溢出，已p1修正未复验 |
| 生产管理 | `pages/ai/yield-forecast` | `#/pages/native/business?target=%252Fproduction%252Fai%252Fyield-forecast` | 发生跳转，见实际落点；页面已渲染；非完整交互验收；曾测到横向溢出，已p1修正未复验 |
| 生产管理 | `pages/food-safety/harvest-block` | `#/pages/food-safety/harvest-block` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/food-safety/input-ai-check` | `#/pages/food-safety/input-ai-check` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/food-safety/ai-verify` | `#/pages/native/business?target=%252Fproduction%252Ftrace%252Ffull-chain` | 发生跳转，见实际落点；页面已渲染；非完整交互验收；曾测到横向溢出，已p1修正未复验 |
| 生产管理 | `pages/profile/settings` | `#/pages/profile/settings` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/business/business` | `#/pages/business/business` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/workspace/workspace` | `#/pages/workbench/workbench` | 发生跳转，见实际落点；页面已渲染；非完整交互验收 |
| 生产管理 | `pages/connection/connection` | `#/pages/connection/connection` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/native/business` | `#/pages/native/business` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/native/harvest-window` | `#/pages/native/harvest-window` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/native/calendar` | `#/pages/native/calendar` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/native/assistant` | `#/pages/native/assistant` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/native/voice` | `#/pages/native/voice` | 页面已渲染；非完整交互验收 |
| 生产管理 | `pages/native/processing` | `#/pages/native/processing` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/index/index` | `#/pages/index/index` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/device/list` | `#/pages/device/list` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/device/detail` | `#/pages/device/detail` | 缺参数/编号提示，未验真实详情 |
| 物联网 | `pages/alert/list` | `#/pages/alert/list` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/plot/list` | `#/pages/plot/list` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/scene/index` | `#/pages/scene/index` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/scene/edit` | `#/pages/scene/edit` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/automation/index` | `#/pages/automation/index` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/automation/edit` | `#/pages/automation/edit` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/messages/index` | `#/pages/messages/index` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/login/index` | `#/` | 发生跳转，见实际落点；页面已渲染；非完整交互验收 |
| 物联网 | `pages/account/index` | `#/pages/account/index` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/monitor/index` | `#/pages/monitor/index` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/device/edit` | `#/pages/device/edit` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/device/sampling` | `#/pages/device/sampling` | 缺参数/编号提示，未验真实详情 |
| 物联网 | `pages/gateway/list` | `#/pages/gateway/list` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/gateway/detail` | `#/pages/gateway/detail` | 缺参数/编号提示，未验真实详情 |
| 物联网 | `pages/gateway/edit` | `#/pages/gateway/edit` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/plot/detail` | `#/pages/plot/detail` | 缺参数/编号提示，未验真实详情 |
| 物联网 | `pages/threshold/index` | `#/pages/threshold/index` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/threshold/edit` | `#/pages/threshold/edit` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/analytics/index` | `#/pages/analytics/index` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/maintenance/index` | `#/pages/maintenance/index` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/maintenance/create` | `#/pages/maintenance/create` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/index` | `#/pages/ops/index` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/list` | `#/pages/ops/list` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/receipts` | `#/pages/ops/receipts` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/devices` | `#/pages/ops/devices` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/gateways` | `#/pages/ops/gateways` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/products` | `#/pages/ops/products` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/access` | `#/pages/ops/access` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/alerts` | `#/pages/ops/alerts` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/rules` | `#/pages/ops/rules` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/workorders` | `#/pages/ops/workorders` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/firmwares` | `#/pages/ops/firmwares` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/ota` | `#/pages/ops/ota` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/tenants` | `#/pages/ops/tenants` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/logs` | `#/pages/ops/logs` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/reports` | `#/pages/ops/reports` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/sampling` | `#/pages/ops/sampling` | 页面已渲染；非完整交互验收；400 /api/v1/iot/ops/devices/NaN/sampling；曾测到不足48px，已定点补丁，最终未复验 |
| 物联网 | `pages/ops/rule-edit` | `#/pages/ops/rule-edit` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/firmware-edit` | `#/pages/ops/firmware-edit` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/ops/firmware-detail` | `#/pages/ops/firmware-detail` | 缺参数/编号提示，未验真实详情；曾测到不足48px，已定点补丁，最终未复验 |
| 物联网 | `pages/ops/ota-execute` | `#/pages/ops/ota-execute` | 缺参数/编号提示，未验真实详情；曾测到不足48px，已定点补丁，最终未复验 |
| 物联网 | `pages/group/index` | `#/pages/group/index` | 页面已渲染；非完整交互验收 |
| 物联网 | `pages/threshold/evaluate` | `#/pages/threshold/evaluate` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/home/index` | `#/pages/home/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/category/index` | `#/pages/category/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/cart/index` | `#/pages/cart/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/profile/index` | `#/pages/profile/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/product/detail` | `#/pages/product/detail` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/checkout/index` | `#/pages/checkout/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/orders/index` | `#/pages/orders/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/orders/detail` | `#/pages/orders/detail` | 采样仍在加载，未判通过 |
| 消费者商城 | `pages/login/index` | `#/pages/login/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/addresses/index` | `#/pages/addresses/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/addresses/edit` | `#/pages/addresses/edit` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/services/index` | `#/pages/services/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/aftersale/index` | `#/pages/aftersale/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/aftersale/apply` | `#/pages/aftersale/apply` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/channel/index` | `#/pages/channel/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/favorites/index` | `#/pages/favorites/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/footprints/index` | `#/pages/footprints/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/messages/index` | `#/pages/messages/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/member/index` | `#/pages/member/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/signin/index` | `#/pages/signin/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/points/index` | `#/pages/points/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/points/mall` | `#/pages/points/mall` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/coupons/index` | `#/pages/coupons/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/security/index` | `#/pages/security/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/logistics/index` | `#/pages/logistics/index` | 缺参数/编号提示，未验真实详情 |
| 消费者商城 | `pages/reviews/index` | `#/pages/reviews/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/reviews/write` | `#/pages/reviews/write` | 缺参数/编号提示，未验真实详情 |
| 消费者商城 | `pages/groups/index` | `#/pages/groups/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/groups/mine` | `#/pages/groups/mine` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/groups/detail` | `#/pages/groups/detail` | 缺参数/编号提示，未验真实详情 |
| 消费者商城 | `pages/flash/index` | `#/pages/flash/index` | 页面已渲染；非完整交互验收 |
| 消费者商城 | `pages/pay/index` | `#/pages/pay/index` | 缺参数/编号提示，未验真实详情 |
| 消费者商城 | `pages/pay/result` | `#/pages/pay/result` | 缺参数/编号提示，未验真实详情 |
| 消费者商城 | `pages/aftersale/detail` | `#/pages/aftersale/detail` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/home/index` | `#/pages/home/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/products/index` | `#/pages/products/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/orders/index` | `#/pages/orders/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/profile/index` | `#/pages/profile/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/pool/index` | `#/pages/pool/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/orders/detail` | `#/pages/orders/detail` | 缺参数/编号提示，未验真实详情 |
| 渠道商工作台 | `pages/commissions/index` | `#/pages/commissions/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/marketing/index` | `#/pages/marketing/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/shop/edit` | `#/pages/shop/edit` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/login/index` | `#/pages/login/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/customers/index` | `#/pages/customers/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/customers/detail` | `#/pages/customers/detail` | 缺参数/编号提示，未验真实详情 |
| 渠道商工作台 | `pages/inventory/index` | `#/pages/inventory/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/reviews/index` | `#/pages/reviews/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/analytics/index` | `#/pages/analytics/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/reconcile/index` | `#/pages/reconcile/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/settlements/index` | `#/pages/settlements/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/notices/index` | `#/pages/notices/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/notices/preferences` | `#/pages/notices/preferences` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/procurement/index` | `#/pages/procurement/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/onboarding/index` | `#/pages/onboarding/index` | 页面已渲染；非完整交互验收 |
| 渠道商工作台 | `pages/growth/index` | `#/pages/growth/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/news/index` | `#/pages/news/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/news/channel` | `#/pages/news/channel` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/news/article` | `#/pages/news/article` | 缺参数/编号提示，未验真实详情 |
| 信息资讯 | `pages/market/index` | `#/pages/market/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/market/variety` | `#/pages/market/variety` | 缺参数/编号提示，未验真实详情 |
| 信息资讯 | `pages/market/price-index` | `#/pages/market/price-index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/alert/setup` | `#/pages/alert/setup` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/alert/messages` | `#/pages/alert/messages` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/ai/index` | `#/pages/ai/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/ai/history` | `#/pages/ai/history` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/search/index` | `#/pages/search/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/message/index` | `#/pages/message/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/favorite/index` | `#/pages/favorite/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/history/index` | `#/pages/history/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/subscription/index` | `#/pages/subscription/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/profile/index` | `#/pages/profile/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/profile/edit` | `#/pages/profile/edit` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/settings/index` | `#/pages/settings/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/help/index` | `#/pages/help/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/course/index` | `#/pages/course/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/course/detail` | `#/pages/course/detail` | 缺参数/编号提示，未验真实详情 |
| 信息资讯 | `pages/course/play` | `#/pages/course/play` | 缺参数/编号提示，未验真实详情 |
| 信息资讯 | `pages/sd/index` | `#/pages/sd/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/sd/publish` | `#/pages/sd/publish` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/sd/detail` | `#/pages/sd/detail` | 缺参数/编号提示，未验真实详情 |
| 信息资讯 | `pages/sd/match` | `#/pages/sd/match` | 缺参数/编号提示，未验真实详情 |
| 信息资讯 | `pages/sd/chat` | `#/pages/sd/chat` | 缺参数/编号提示，未验真实详情 |
| 信息资讯 | `pages/sd/mine` | `#/pages/sd/mine` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/report/detail` | `#/pages/report/detail` | 缺参数/编号提示，未验真实详情 |
| 信息资讯 | `pages/report/mine` | `#/pages/report/mine` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/attest/index` | `#/pages/attest/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/attest/detail` | `#/pages/attest/detail` | 缺参数/编号提示，未验真实详情 |
| 信息资讯 | `pages/attest/verify` | `#/pages/attest/verify` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/expert/apply` | `#/pages/expert/apply` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/expert/verify` | `#/pages/expert/verify` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/expert/detail` | `#/pages/expert/detail` | 缺参数/编号提示，未验真实详情 |
| 信息资讯 | `pages/expert/cert` | `#/pages/expert/cert` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/login/index` | `#/pages/login/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/knowledge/index` | `#/pages/knowledge/index` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/knowledge/detail` | `#/pages/knowledge/detail` | 缺参数/编号提示，未验真实详情 |
| 信息资讯 | `pages/ai/detail` | `#/pages/ai/detail` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/market/compare` | `#/pages/market/compare` | 页面已渲染；非完整交互验收 |
| 信息资讯 | `pages/expert/index` | `#/pages/expert/index` | 页面已渲染；非完整交互验收 |
| 综合服务 | `pages/home/index` | `#/pages/home/index` | 页面已渲染；非完整交互验收 |
| 综合服务 | `pages/services/index` | `#/pages/services/index` | 页面已渲染；非完整交互验收 |
| 综合服务 | `pages/provider/detail` | `#/pages/provider/detail` | 缺参数/编号提示，未验真实详情 |
| 综合服务 | `pages/booking/index` | `#/pages/booking/index` | 缺参数/编号提示，未验真实详情 |
| 综合服务 | `pages/orders/index` | `#/pages/orders/index` | 页面已渲染；非完整交互验收 |
| 综合服务 | `pages/orders/detail` | `#/pages/orders/detail` | 采样仍在加载，未判通过 |
| 综合服务 | `pages/demand/publish` | `#/pages/demand/publish` | 页面已渲染；非完整交互验收 |
| 综合服务 | `pages/insurance/index` | `#/pages/insurance/index` | 页面已渲染；非完整交互验收 |
| 综合服务 | `pages/policies/index` | `#/pages/policies/index` | 页面已渲染；非完整交互验收 |
| 综合服务 | `pages/ai/index` | `#/pages/ai/index` | 页面已渲染；非完整交互验收；曾测到不足48px，已定点补丁，最终未复验 |
| 综合服务 | `pages/workbench/index` | `#/pages/workbench/index` | 页面已渲染；非完整交互验收；403 /api/v1/service/mobile/workbench |
| 综合服务 | `pages/profile/index` | `#/pages/profile/index` | 页面已渲染；非完整交互验收；曾测到不足48px，已定点补丁，最终未复验 |
| 综合服务 | `pages/messages/index` | `#/pages/messages/index` | 页面已渲染；非完整交互验收 |
| 综合服务 | `pages/login/index` | `#/pages/login/index` | 页面已渲染；非完整交互验收 |
| 综合服务 | `pages/demand/index` | `#/pages/demand/index` | 页面已渲染；非完整交互验收 |
| 综合服务 | `pages/feedback/index` | `#/pages/feedback/index` | 页面已渲染；非完整交互验收 |
| 综合服务 | `pages/consult/index` | `#/pages/consult/index` | 页面已渲染；非完整交互验收 |
| 综合服务 | `pages/resources/index` | `#/pages/resources/index` | 页面已渲染；非完整交互验收 |
| 综合服务 | `pages/training/index` | `#/pages/training/index` | 页面已渲染；非完整交互验收 |
| 综合服务 | `pages/join/index` | `#/pages/join/index` | 页面已渲染；非完整交互验收 |
| 综合服务 | `pages/expert/index` | `#/pages/expert/index` | 页面已渲染；非完整交互验收；403 /api/v1/service/expert/profile；403 /api/v1/service/expert/consultations |
| 移动执法 | `pages/workbench/index` | `#/pages/workbench/index` | 页面已渲染；非完整交互验收 |
| 移动执法 | `pages/tasks/index` | `#/pages/tasks/index` | 页面已渲染；非完整交互验收 |
| 移动执法 | `pages/tasks/detail` | `#/pages/tasks/detail` | 缺参数/编号提示，未验真实详情 |
| 移动执法 | `pages/tasks/checklist` | `#/pages/tasks/checklist` | 缺参数/编号提示，未验真实详情 |
| 移动执法 | `pages/scan/index` | `#/pages/scan/index` | 页面已渲染；非完整交互验收 |
| 移动执法 | `pages/cases/index` | `#/pages/cases/index` | 页面已渲染；非完整交互验收 |
| 移动执法 | `pages/cases/create` | `#/pages/cases/create` | 页面已渲染；非完整交互验收 |
| 移动执法 | `pages/evidence/index` | `#/pages/evidence/index` | 页面已渲染；非完整交互验收 |
| 移动执法 | `pages/messages/index` | `#/pages/messages/index` | 页面已渲染；非完整交互验收 |
| 移动执法 | `pages/profile/index` | `#/pages/profile/index` | 页面已渲染；非完整交互验收；曾测到不足48px，已定点补丁，最终未复验 |
| 移动执法 | `pages/login/index` | `#/pages/login/index` | 页面已渲染；非完整交互验收 |
| 移动执法 | `pages/cases/detail` | `#/pages/cases/detail` | 缺参数/编号提示，未验真实详情 |
| 移动执法 | `pages/evidence/detail` | `#/pages/evidence/detail` | 缺参数/编号提示，未验真实详情 |
| 移动执法 | `pages/messages/detail` | `#/pages/messages/detail` | 缺参数/编号提示，未验真实详情 |
| 移动执法 | `pages/warnings/detail` | `#/pages/warnings/detail` | 缺参数/编号提示，未验真实详情 |


---

## 历史检查记录（版本与结论以各节当时状态为准）

8 个 H5 入口已发布。交易首页进行了 375 × 812 截图抽查，并在抽查后修正顶部配色。资讯首页与商城登录页做了浏览器文字抽查。

以下为注册路由对应的页面源码检查。关键词仅用来定位后续检查目标，组件内部实现、动态数据和真机效果需要单独验证。

| 工程 | 注册页面 | 加载线索 | 错误线索 | 重试线索 |
|---|---|---|---|---|
| agri-government/mobile | pages/workbench/index | 有 | 有 | 有 |
| agri-government/mobile | pages/tasks/index | 有 | 有 | 有 |
| agri-government/mobile | pages/tasks/detail | 有 | 有 | 有 |
| agri-government/mobile | pages/tasks/checklist | 有 | 有 | 有 |
| agri-government/mobile | pages/scan/index | 有 | 有 | 有 |
| agri-government/mobile | pages/cases/index | 有 | 有 | 有 |
| agri-government/mobile | pages/cases/create | 有 | 有 | 有 |
| agri-government/mobile | pages/evidence/index | 有 | 有 | 有 |
| agri-government/mobile | pages/messages/index | 有 | 有 | 有 |
| agri-government/mobile | pages/profile/index | 待查组件 | 有 | 待查组件 |
| agri-government/mobile | pages/login/index | 待查组件 | 有 | 有 |
| agri-government/mobile | pages/cases/detail | 有 | 有 | 有 |
| agri-government/mobile | pages/evidence/detail | 有 | 有 | 有 |
| agri-government/mobile | pages/messages/detail | 有 | 有 | 有 |
| agri-government/mobile | pages/warnings/detail | 有 | 有 | 有 |
| agri-info/mobile | pages/news/index | 有 | 有 | 有 |
| agri-info/mobile | pages/news/channel | 有 | 有 | 待查组件 |
| agri-info/mobile | pages/news/article | 有 | 有 | 待查组件 |
| agri-info/mobile | pages/market/index | 有 | 有 | 待查组件 |
| agri-info/mobile | pages/market/variety | 有 | 有 | 待查组件 |
| agri-info/mobile | pages/market/price-index | 有 | 有 | 有 |
| agri-info/mobile | pages/alert/setup | 有 | 有 | 待查组件 |
| agri-info/mobile | pages/alert/messages | 有 | 有 | 待查组件 |
| agri-info/mobile | pages/ai/index | 待查组件 | 有 | 待查组件 |
| agri-info/mobile | pages/ai/history | 有 | 有 | 待查组件 |
| agri-info/mobile | pages/search/index | 有 | 有 | 待查组件 |
| agri-info/mobile | pages/message/index | 有 | 有 | 有 |
| agri-info/mobile | pages/favorite/index | 有 | 有 | 待查组件 |
| agri-info/mobile | pages/history/index | 待查组件 | 待查组件 | 待查组件 |
| agri-info/mobile | pages/subscription/index | 有 | 有 | 待查组件 |
| agri-info/mobile | pages/profile/index | 待查组件 | 有 | 待查组件 |
| agri-info/mobile | pages/profile/edit | 有 | 有 | 有 |
| agri-info/mobile | pages/settings/index | 待查组件 | 待查组件 | 待查组件 |
| agri-info/mobile | pages/help/index | 待查组件 | 待查组件 | 待查组件 |
| agri-info/mobile | pages/course/index | 有 | 有 | 待查组件 |
| agri-info/mobile | pages/course/detail | 有 | 有 | 待查组件 |
| agri-info/mobile | pages/course/play | 有 | 有 | 有 |
| agri-info/mobile | pages/sd/index | 有 | 有 | 待查组件 |
| agri-info/mobile | pages/sd/publish | 有 | 有 | 有 |
| agri-info/mobile | pages/sd/detail | 有 | 有 | 有 |
| agri-info/mobile | pages/sd/match | 有 | 有 | 待查组件 |
| agri-info/mobile | pages/sd/chat | 有 | 有 | 有 |
| agri-info/mobile | pages/sd/mine | 有 | 有 | 待查组件 |
| agri-info/mobile | pages/report/detail | 有 | 有 | 有 |
| agri-info/mobile | pages/report/mine | 有 | 有 | 有 |
| agri-info/mobile | pages/attest/index | 有 | 有 | 有 |
| agri-info/mobile | pages/attest/detail | 有 | 有 | 有 |
| agri-info/mobile | pages/attest/verify | 有 | 有 | 待查组件 |
| agri-info/mobile | pages/expert/apply | 有 | 有 | 有 |
| agri-info/mobile | pages/expert/verify | 有 | 有 | 有 |
| agri-info/mobile | pages/expert/detail | 有 | 有 | 有 |
| agri-info/mobile | pages/expert/cert | 有 | 有 | 有 |
| agri-info/mobile | pages/login/index | 待查组件 | 有 | 待查组件 |
| agri-info/mobile | pages/knowledge/index | 有 | 有 | 有 |
| agri-info/mobile | pages/knowledge/detail | 有 | 有 | 有 |
| agri-info/mobile | pages/ai/detail | 有 | 有 | 有 |
| agri-info/mobile | pages/market/compare | 有 | 有 | 有 |
| agri-info/mobile | pages/expert/index | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/index/index | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/device/list | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/device/detail | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/alert/list | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/plot/list | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/scene/index | 有 | 有 | 待查组件 |
| agri-iot/miniprogram | pages/scene/edit | 有 | 有 | 待查组件 |
| agri-iot/miniprogram | pages/automation/index | 有 | 有 | 待查组件 |
| agri-iot/miniprogram | pages/automation/edit | 有 | 有 | 待查组件 |
| agri-iot/miniprogram | pages/messages/index | 有 | 有 | 待查组件 |
| agri-iot/miniprogram | pages/login/index | 待查组件 | 有 | 有 |
| agri-iot/miniprogram | pages/account/index | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/monitor/index | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/device/edit | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/device/sampling | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/gateway/list | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/gateway/detail | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/gateway/edit | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/plot/detail | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/threshold/index | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/threshold/edit | 有 | 有 | 待查组件 |
| agri-iot/miniprogram | pages/analytics/index | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/maintenance/index | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/maintenance/create | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/ops/index | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/ops/list | 待查组件 | 待查组件 | 待查组件 |
| agri-iot/miniprogram | pages/ops/receipts | 待查组件 | 有 | 待查组件 |
| agri-iot/miniprogram | pages/ops/devices | 待查组件 | 待查组件 | 待查组件 |
| agri-iot/miniprogram | pages/ops/gateways | 待查组件 | 待查组件 | 待查组件 |
| agri-iot/miniprogram | pages/ops/products | 待查组件 | 待查组件 | 待查组件 |
| agri-iot/miniprogram | pages/ops/access | 待查组件 | 待查组件 | 待查组件 |
| agri-iot/miniprogram | pages/ops/alerts | 待查组件 | 待查组件 | 待查组件 |
| agri-iot/miniprogram | pages/ops/rules | 待查组件 | 待查组件 | 待查组件 |
| agri-iot/miniprogram | pages/ops/workorders | 待查组件 | 待查组件 | 待查组件 |
| agri-iot/miniprogram | pages/ops/firmwares | 待查组件 | 待查组件 | 待查组件 |
| agri-iot/miniprogram | pages/ops/ota | 待查组件 | 待查组件 | 待查组件 |
| agri-iot/miniprogram | pages/ops/tenants | 待查组件 | 待查组件 | 待查组件 |
| agri-iot/miniprogram | pages/ops/logs | 待查组件 | 待查组件 | 待查组件 |
| agri-iot/miniprogram | pages/ops/reports | 待查组件 | 待查组件 | 待查组件 |
| agri-iot/miniprogram | pages/ops/sampling | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/ops/rule-edit | 有 | 有 | 待查组件 |
| agri-iot/miniprogram | pages/ops/firmware-edit | 有 | 有 | 待查组件 |
| agri-iot/miniprogram | pages/ops/firmware-detail | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/ops/ota-execute | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/group/index | 有 | 有 | 有 |
| agri-iot/miniprogram | pages/threshold/evaluate | 有 | 有 | 有 |
| agri-production/miniprogram | pages/alerts/review | 有 | 有 | 有 |
| agri-production/miniprogram | pages/native/analytics | 待查组件 | 有 | 待查组件 |
| agri-production/miniprogram | pages/native/reports | 有 | 有 | 待查组件 |
| agri-production/miniprogram | pages/native/import | 有 | 有 | 待查组件 |
| agri-production/miniprogram | pages/native/growth-analysis | 有 | 有 | 待查组件 |
| agri-production/miniprogram | pages/native/exports | 有 | 有 | 待查组件 |
| agri-production/miniprogram | pages/login/login | 待查组件 | 有 | 有 |
| agri-production/miniprogram | pages/register/register | 有 | 有 | 待查组件 |
| agri-production/miniprogram | pages/workbench/workbench | 待查组件 | 有 | 有 |
| agri-production/miniprogram | pages/plots/plots | 有 | 有 | 有 |
| agri-production/miniprogram | pages/tasks/tasks | 有 | 有 | 有 |
| agri-production/miniprogram | pages/harvests/harvests | 有 | 有 | 有 |
| agri-production/miniprogram | pages/profile/profile | 待查组件 | 有 | 有 |
| agri-production/miniprogram | pages/messages/messages | 有 | 有 | 有 |
| agri-production/miniprogram | pages/plots/detail | 有 | 有 | 有 |
| agri-production/miniprogram | pages/plots/map | 待查组件 | 有 | 待查组件 |
| agri-production/miniprogram | pages/plots/map-embed | 待查组件 | 待查组件 | 待查组件 |
| agri-production/miniprogram | pages/plots/create | 待查组件 | 有 | 有 |
| agri-production/miniprogram | pages/tasks/detail | 有 | 有 | 有 |
| agri-production/miniprogram | pages/tasks/create | 有 | 有 | 有 |
| agri-production/miniprogram | pages/inputs/scan | 有 | 有 | 有 |
| agri-production/miniprogram | pages/inputs/detail | 待查组件 | 有 | 待查组件 |
| agri-production/miniprogram | pages/harvests/create | 有 | 有 | 有 |
| agri-production/miniprogram | pages/harvests/detail | 有 | 有 | 有 |
| agri-production/miniprogram | pages/inventory/inventory | 有 | 有 | 有 |
| agri-production/miniprogram | pages/trace/scan | 待查组件 | 有 | 待查组件 |
| agri-production/miniprogram | pages/alerts/alerts | 有 | 有 | 有 |
| agri-production/miniprogram | pages/ai/pest-detection | 待查组件 | 待查组件 | 待查组件 |
| agri-production/miniprogram | pages/ai/prescription | 待查组件 | 待查组件 | 待查组件 |
| agri-production/miniprogram | pages/ai/assistant | 待查组件 | 待查组件 | 待查组件 |
| agri-production/miniprogram | pages/ai/remote-sensing | 待查组件 | 待查组件 | 待查组件 |
| agri-production/miniprogram | pages/ai/alerts | 待查组件 | 待查组件 | 待查组件 |
| agri-production/miniprogram | pages/ai/yield-forecast | 待查组件 | 待查组件 | 待查组件 |
| agri-production/miniprogram | pages/food-safety/harvest-block | 有 | 有 | 有 |
| agri-production/miniprogram | pages/food-safety/input-ai-check | 有 | 有 | 待查组件 |
| agri-production/miniprogram | pages/food-safety/ai-verify | 待查组件 | 待查组件 | 待查组件 |
| agri-production/miniprogram | pages/profile/settings | 待查组件 | 待查组件 | 待查组件 |
| agri-production/miniprogram | pages/business/business | 待查组件 | 待查组件 | 待查组件 |
| agri-production/miniprogram | pages/workspace/workspace | 待查组件 | 有 | 待查组件 |
| agri-production/miniprogram | pages/connection/connection | 待查组件 | 有 | 待查组件 |
| agri-production/miniprogram | pages/native/business | 有 | 有 | 有 |
| agri-production/miniprogram | pages/native/harvest-window | 有 | 有 | 有 |
| agri-production/miniprogram | pages/native/calendar | 有 | 有 | 有 |
| agri-production/miniprogram | pages/native/assistant | 有 | 有 | 有 |
| agri-production/miniprogram | pages/native/voice | 有 | 有 | 有 |
| agri-production/miniprogram | pages/native/processing | 有 | 有 | 待查组件 |
| agri-s2b2c/mobile-channel | pages/home/index | 待查组件 | 有 | 待查组件 |
| agri-s2b2c/mobile-channel | pages/products/index | 有 | 有 | 待查组件 |
| agri-s2b2c/mobile-channel | pages/orders/index | 有 | 有 | 有 |
| agri-s2b2c/mobile-channel | pages/profile/index | 有 | 有 | 待查组件 |
| agri-s2b2c/mobile-channel | pages/pool/index | 有 | 有 | 有 |
| agri-s2b2c/mobile-channel | pages/orders/detail | 有 | 有 | 有 |
| agri-s2b2c/mobile-channel | pages/commissions/index | 有 | 有 | 有 |
| agri-s2b2c/mobile-channel | pages/marketing/index | 待查组件 | 有 | 待查组件 |
| agri-s2b2c/mobile-channel | pages/shop/edit | 有 | 有 | 待查组件 |
| agri-s2b2c/mobile-channel | pages/login/index | 待查组件 | 有 | 待查组件 |
| agri-s2b2c/mobile-channel | pages/customers/index | 有 | 有 | 有 |
| agri-s2b2c/mobile-channel | pages/customers/detail | 有 | 有 | 有 |
| agri-s2b2c/mobile-channel | pages/inventory/index | 有 | 有 | 有 |
| agri-s2b2c/mobile-channel | pages/reviews/index | 有 | 有 | 有 |
| agri-s2b2c/mobile-channel | pages/analytics/index | 有 | 有 | 有 |
| agri-s2b2c/mobile-channel | pages/reconcile/index | 有 | 有 | 有 |
| agri-s2b2c/mobile-channel | pages/settlements/index | 有 | 有 | 有 |
| agri-s2b2c/mobile-channel | pages/notices/index | 有 | 有 | 有 |
| agri-s2b2c/mobile-channel | pages/notices/preferences | 有 | 有 | 有 |
| agri-s2b2c/mobile-channel | pages/procurement/index | 有 | 有 | 有 |
| agri-s2b2c/mobile-channel | pages/onboarding/index | 有 | 有 | 有 |
| agri-s2b2c/mobile-channel | pages/growth/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/home/index | 有 | 有 | 待查组件 |
| agri-s2b2c/mobile | pages/category/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/cart/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/profile/index | 待查组件 | 有 | 待查组件 |
| agri-s2b2c/mobile | pages/product/detail | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/checkout/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/orders/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/orders/detail | 有 | 有 | 待查组件 |
| agri-s2b2c/mobile | pages/login/index | 待查组件 | 有 | 待查组件 |
| agri-s2b2c/mobile | pages/addresses/index | 待查组件 | 有 | 待查组件 |
| agri-s2b2c/mobile | pages/addresses/edit | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/services/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/aftersale/index | 有 | 有 | 待查组件 |
| agri-s2b2c/mobile | pages/aftersale/apply | 有 | 有 | 待查组件 |
| agri-s2b2c/mobile | pages/channel/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/favorites/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/footprints/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/messages/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/member/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/signin/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/points/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/points/mall | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/coupons/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/security/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/logistics/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/reviews/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/reviews/write | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/groups/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/groups/mine | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/groups/detail | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/flash/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/pay/index | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/pay/result | 有 | 有 | 有 |
| agri-s2b2c/mobile | pages/aftersale/detail | 有 | 有 | 有 |
| agri-service/mobile | pages/home/index | 有 | 有 | 有 |
| agri-service/mobile | pages/services/index | 有 | 有 | 有 |
| agri-service/mobile | pages/provider/detail | 有 | 有 | 有 |
| agri-service/mobile | pages/booking/index | 有 | 有 | 待查组件 |
| agri-service/mobile | pages/orders/index | 有 | 有 | 有 |
| agri-service/mobile | pages/orders/detail | 有 | 有 | 有 |
| agri-service/mobile | pages/demand/publish | 有 | 有 | 待查组件 |
| agri-service/mobile | pages/insurance/index | 有 | 有 | 有 |
| agri-service/mobile | pages/policies/index | 有 | 有 | 待查组件 |
| agri-service/mobile | pages/ai/index | 有 | 有 | 待查组件 |
| agri-service/mobile | pages/workbench/index | 有 | 有 | 有 |
| agri-service/mobile | pages/profile/index | 待查组件 | 有 | 待查组件 |
| agri-service/mobile | pages/messages/index | 待查组件 | 有 | 待查组件 |
| agri-service/mobile | pages/login/index | 待查组件 | 有 | 待查组件 |
| agri-service/mobile | pages/demand/index | 有 | 有 | 有 |
| agri-service/mobile | pages/feedback/index | 有 | 有 | 有 |
| agri-service/mobile | pages/consult/index | 有 | 有 | 有 |
| agri-service/mobile | pages/resources/index | 有 | 有 | 有 |
| agri-service/mobile | pages/training/index | 有 | 有 | 有 |
| agri-service/mobile | pages/join/index | 有 | 有 | 待查组件 |
| agri-service/mobile | pages/expert/index | 有 | 有 | 有 |
| agri-trade/miniprogram | pages/home/index | 有 | 有 | 有 |
| agri-trade/miniprogram | pages/products/index | 有 | 有 | 有 |
| agri-trade/miniprogram | pages/product/detail | 有 | 有 | 有 |
| agri-trade/miniprogram | pages/demands/index | 有 | 有 | 有 |
| agri-trade/miniprogram | pages/orders/index | 有 | 有 | 有 |
| agri-trade/miniprogram | pages/profile/index | 待查组件 | 待查组件 | 待查组件 |
| agri-trade/miniprogram | pages/publish-demand/index | 待查组件 | 待查组件 | 待查组件 |
| agri-trade/miniprogram | pages/login/index | 待查组件 | 有 | 有 |
| agri-trade/miniprogram | pages/match/index | 有 | 有 | 待查组件 |
| agri-trade/miniprogram | pages/order-detail/index | 有 | 有 | 有 |
| agri-trade/miniprogram | pages/contracts/index | 有 | 有 | 有 |
| agri-trade/miniprogram | pages/contract-detail/index | 有 | 有 | 有 |
| agri-trade/miniprogram | pages/logistics/index | 有 | 有 | 有 |
| agri-trade/miniprogram | pages/workspace/index | 有 | 有 | 有 |
| agri-trade/miniprogram | pages/business/index | 有 | 有 | 有 |
| agri-trade/miniprogram | pages/checkout/index | 有 | 有 | 有 |
| agri-trade/miniprogram | pages/buyer/overview | 待查组件 | 待查组件 | 待查组件 |
| agri-trade/miniprogram | pages/buyer/demand | 待查组件 | 待查组件 | 待查组件 |
| agri-trade/miniprogram | pages/buyer/inquiry | 待查组件 | 待查组件 | 待查组件 |
| agri-trade/miniprogram | pages/buyer/after | 待查组件 | 待查组件 | 待查组件 |
| agri-trade/miniprogram | pages/buyer/fund | 待查组件 | 待查组件 | 待查组件 |
| agri-trade/miniprogram | pages/seller/overview | 待查组件 | 待查组件 | 待查组件 |
| agri-trade/miniprogram | pages/seller/goods | 待查组件 | 待查组件 | 待查组件 |
| agri-trade/miniprogram | pages/seller/quote | 待查组件 | 待查组件 | 待查组件 |
| agri-trade/miniprogram | pages/seller/p2t | 待查组件 | 待查组件 | 待查组件 |
| agri-trade/miniprogram | pages/seller/customer | 待查组件 | 待查组件 | 待查组件 |
| agri-trade/miniprogram | pages/seller/fund | 待查组件 | 待查组件 | 待查组件 |
| agri-trade/miniprogram | pages/collaboration/chat | 待查组件 | 待查组件 | 待查组件 |
| agri-trade/miniprogram | pages/collaboration/agent | 待查组件 | 待查组件 | 待查组件 |
| agri-trade/miniprogram | pages/collaboration/price | 待查组件 | 待查组件 | 待查组件 |
| agri-trade/miniprogram | pages/identity/index | 待查组件 | 待查组件 | 待查组件 |


## 补充：共用登录样式发布到 8 个移动端（2026-11-20 11:10 后）

共用登录样式 `packages/agri-shared/src/styles/mobile-login.css` 本日改动：辅助小字 12 / 12.5px；文字链和「获取验证码」点击区 44px；协议里的《用户协议》《隐私政策》点击区 16 → 44px；返回键「‹」36 × 36 → 44 × 44。

| 移动端 | 发布名 | 当前版本 | 回滚到今天上午版本 |
| --- | --- | --- | --- |
| 交易撮合 | trade-mobile | 20261120-ui-v1-r6 | `--repoint 20261120-ui-v1-r5` |
| 生产管理 | prod-mobile | 20261120-ui-v1-r3 | `--repoint 20261120-ui-v1` |
| 物联网 | iot-mobile | 20261120-ui-v1-r3 | `--repoint 20261120-ui-v1` |
| 消费者商城 | mall-mobile | 20261120-ui-v1-r3 | `--repoint 20261120-ui-v1` |
| 渠道商工作台 | mall-channel-mobile | 20261120-ui-v1-r3 | `--repoint 20261120-ui-v1` |
| 信息资讯 | info-mobile | 20261120-ui-v1-r3 | `--repoint 20261120-ui-v1` |
| 综合服务 | service-mobile | 20261120-ui-v1-r3 | `--repoint 20261120-ui-v1` |
| 移动执法 | gov-mobile | 20261120-ui-v1-r3 | `--repoint 20261120-ui-v1` |

回滚命令格式：`node ops/gateway/scripts/publish.mjs --app <发布名> --repoint <版本>`。

登录页实测（无头 Chrome，375 × 812）：8 个端都能打开，小于 12px 的文字 0 处、小于 44px 的点击区 0 处、脚本异常 0、接口 4xx / 5xx 0。首轮（r2）检查时 7 个端的协议链接只有 16px 高，商城和渠道商的返回键 36px，改样式后发布 r3 / r6 复测通过。

范围：只检查了未登录状态下的登录页；各端登录后的页面没有逐页复验，小程序和 App 没有重新编译和真机预览。

## 补充：8 个移动端微信小程序编译（2026-11-20 11:20）

命令：各工程 `uni build -p mp-weixin`（产物通过 `UNI_OUTPUT_DIR` 输出到临时目录，没有写进工程的 `dist/build/mp-weixin`），以及 `vue-tsc --noEmit`。源码为发布 H5 `r3` / `r6` 时的同一份。

| 移动端 | 工程 | 编译 | 类型检查 | 注册页面 → 产物页面 | 产物文件 | 主包大小 | 小程序 appid |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 交易撮合 | agri-trade/miniprogram | 通过 | 通过 | 31 → 31 | 160 | 308 KB | wx1de8bb7dc46fb3a2 |
| 生产管理 | agri-production/miniprogram | 通过 | 通过 | 46 → 46 | 249 | 564 KB | touristappid（未配置） |
| 物联网 | agri-iot/miniprogram | 通过 | 通过 | 46 → 46 | 233 | 356 KB | wx1de8bb7dc46fb3a2 |
| 消费者商城 | agri-s2b2c/mobile | 通过 | 通过 | 34 → 34 | 164 | 338 KB | touristappid（未配置） |
| 渠道商工作台 | agri-s2b2c/mobile-channel | 通过 | 通过 | 22 → 22 | 116 | 261 KB | touristappid（未配置） |
| 信息资讯 | agri-info/mobile | 通过 | 通过 | 43 → 43 | 195 | 377 KB | touristappid（未配置） |
| 综合服务 | agri-service/mobile | 通过 | 通过 | 21 → 21 | 98 | 283 KB | touristappid（未配置） |
| 移动执法 | agri-government/mobile | 通过 | 通过 | 15 → 15 | 83 | 195 KB | touristappid（未配置） |

- 每个产物页面的 `.js`、`.wxml`、`.json` 都齐全；均未使用分包，主包都远低于微信 2 MB 上限。
- 编译日志里没有错误，只有 Dart Sass 的弃用提示（`legacy-js-api`、`@import`），不影响当前构建。
- 共用登录样式已带进 8 个小程序：协议链接上下内边距 14px（点击区 44px）、返回键 44 × 44。
- 6 个端的 appid 仍是 `touristappid`，只能在开发者工具里以游客身份预览，不能真机预览或上传；交易撮合与物联网共用同一个 appid，正式上传前需要分开。
- 未做：微信开发者工具打开、真机扫码预览（胶囊遮挡、安全区）、App 端编译。

## 补充：8 个移动端 App 端编译（2026-11-20 11:30）

命令：各工程 `uni build -p app`（即 `npm run build:app`），产物通过 `UNI_OUTPUT_DIR` 输出到临时目录，没有写进工程的 `dist/build/app`。源码与小程序编译、H5 `r3` / `r6` 为同一份。产出的是 App 资源包（`app-service.js`、`manifest.json` 等），还不是可安装的 apk / ipa。

| 移动端 | 工程 | 编译 | 注册页面 → 产物页面 | 产物文件 | 资源包大小 | app-service.js | manifest id |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 交易撮合 | agri-trade/miniprogram | 通过（4.8 秒） | 31 → 31 | 63 | 968 KB | 184 KB | `__UNI__AGRI_TRADE` |
| 生产管理 | agri-production/miniprogram | 通过（5.6 秒） | 46 → 46 | 78 | 1180 KB | 410 KB | `__UNI__AGRI_PROD` |
| 物联网 | agri-iot/miniprogram | 通过（4.9 秒） | 46 → 46 | 78 | 1064 KB | 224 KB | `__UNI__AGRI_IOT` |
| 消费者商城 | agri-s2b2c/mobile | 通过（4.6 秒） | 34 → 34 | 64 | 957 KB | 169 KB | `__UNI__AGRI_S2B2C_MOBILE` |
| 渠道商工作台 | agri-s2b2c/mobile-channel | 通过（4.6 秒） | 22 → 22 | 52 | 880 KB | 130 KB | `__UNI__AGRI_S2B2C_CHANNEL_MOBILE` |
| 信息资讯 | agri-info/mobile | 通过（4.9 秒） | 43 → 43 | 65 | 995 KB | 242 KB | `__UNI__AGRI_INFO` |
| 综合服务 | agri-service/mobile | 通过（4.5 秒） | 21 → 21 | 43 | 898 KB | 157 KB | `__UNI__AGRI_SERVICE` |
| 移动执法 | agri-government/mobile | 通过（4.2 秒） | 15 → 15 | 40 | 828 KB | 95 KB | `__UNI__AGRI_GOVERNMENT` |

- 每个端注册的页面都出现在 `app-config-service.js` 的路由表和 `app-service.js` 里，没有缺页。
- 编译日志无错误，只有 Dart Sass 弃用提示（`legacy-js-api`、`@import`，每端 9–32 条）。
- 共用登录样式已带进 8 个 App 包：协议链接上下内边距 14px（点击区 44px）、返回键 44 × 44。
- 8 个端的 manifest id 互不重复，但都是自定义名字，不是 DCloud 开发者中心分配的 appid，云打包前需要先在开发者中心申请并替换。

**装到手机前必须处理：接口地址。** App 没有 H5 的同源代理，接口地址要在编译时用环境变量写成服务器的完整地址。各工程目前只有 `.env.example`（地址为 `*.example.com` 示例），所以这次的 App 包里：

| 移动端 | 编译进去的接口地址 | 需要配置的变量 |
| --- | --- | --- |
| 交易撮合 | 相对路径 `/api/...` | `VITE_TRADE_API_BASE`、`VITE_TRADE_AUTH_BASE` |
| 生产管理 | 相对路径 `/api/v1/...` | `VITE_API_BASE` |
| 物联网 | 相对路径 `/api/v1/...` | `VITE_IOT_API_BASE`、`VITE_IOT_AUTH_BASE`（仅 `.env.wechat.local` 里有局域网地址，只用于小程序 `--mode wechat`） |
| 消费者商城 | `http://127.0.0.1:8088/api` | `VITE_S2B2C_API_BASE`、`VITE_S2B2C_AUTH_BASE` |
| 渠道商工作台 | `http://127.0.0.1:8088/api` | `VITE_S2B2C_API_BASE`、`VITE_S2B2C_AUTH_BASE` |
| 信息资讯 | `http://127.0.0.1:8093`、`:8096` | `VITE_INFO_API_BASE`、`VITE_INFO_AUTH_BASE`、`VITE_INFO_MEDIA_BASE` |
| 综合服务 | 相对路径 `/api/v1/service` | `VITE_SERVICE_API_BASE`、`VITE_SERVICE_AUTH_BASE` |
| 移动执法 | 相对路径 `/api/v1/...` | `VITE_GOVERNMENT_API_BASE`、`VITE_GOVERNMENT_AUTH_BASE` |

相对路径和 `127.0.0.1` 在手机上都连不到后端：页面能打开，但登录和数据加载会失败。配好对应的 `.env.production`（或在 CI 里注入）后重新执行 `npm run build:app` 即可。

- 8 个端的 manifest 都没有填安卓包名（`packagename`）和 iOS Bundle ID，打包时需要补上，另外还需要签名证书。
- 未做：生成 apk / ipa（需 HBuilderX 云打包或离线 SDK）、模拟器或真机运行（刘海屏、安全区、相机 / 定位权限弹窗）。


## 补充：移动端规范第二次优化与 H5 发布（2026-11-20）

本节是本次最新结果。前面的发布表、小程序与 App 编译记录保留为历史记录，不代表本次源码对应的产物。

### 已实施

- 调整 8 个移动端浅灰辅助文字、警告文字和错误文字颜色，修改共用登录页链接与辅助文字颜色。
- 按价格规范调整多处金额字号和字重；生产端底部标签字号从 11px 调整为 12px。
- 为渠道商营销页补充两列指标卡，数字 20px，说明 12.5px。
- 共用样式为选定按钮、链接、筛选项等增加透明伪元素热区；H5 返回键扩大至 48px；补充减少动效规则。
- 热区检查按元素或 ::before 的几何尺寸计算，不等于相邻热区无重叠、无裁切或全部能正确命中的行为验收。当前仍有待核实的尺寸告警。
- 最后一次 H5 构建与发布全部成功；生产地图在中间一次检查出现 extend 异常，最后一次未复现，未修改地图代码，不能据此认定已修复。

### 当前版本与自动扫描结果

检查使用 375×812 的无头 Chrome。共导航 258 条注册路由，并非 258 个独立业务页面均已通过：权限/工作区重定向、兼容路由和缺少业务 ID 会影响覆盖。
对比度扫描主要按普通文字 4.5:1、大字 3:1及规范明确列出的价格/按钮例外计算，**未完成正文 7:1 的语义逐项验收**。没有逐页视觉截图、长文本、断网/弱网、安全区或完整业务流程验收。

| 移动端 | 当前 H5 版本 | 导航路由 | 小于12px文字 | 对比度候选 | 小于44px热区候选 | 44–48px候选 | 接口错误响应 |
|---|---|---:|---:|---:|---:|---:|---:|
| 交易撮合 | 20261120-ui-v1-r8 | 31 | 0 | 0 | 0 | 0 | 0 |
| 生产管理 | 20261120-ui-v1-r5 | 46 | 1 | 18 | 20 | 10 | 2 |
| 物联网 | 20261120-ui-v1-r5 | 46 | 0 | 0 | 0 | 0 | 3 |
| 消费者商城 | 20261120-ui-v1-r5 | 34 | 0 | 13 | 20 | 4 | 0 |
| 渠道商工作台 | 20261120-ui-v1-r5 | 22 | 2 | 6 | 0 | 5 | 0 |
| 信息资讯 | 20261120-ui-v1-r5 | 43 | 0 | 0 | 9 | 21 | 10 |
| 综合服务 | 20261120-ui-v1-r5 | 21 | 0 | 0 | 0 | 4 | 27 |
| 移动执法 | 20261120-ui-v1-r5 | 15 | 0 | 0 | 0 | 2 | 0 |

以上是 DOM 命中次数，重复页面会重复计数，不是独立缺陷数。候选还包含装饰箭头、分类图标、第三方地图控件等误报。最后一轮未发现文档级横向溢出或 pageerror，但不代表业务可用性全部通过。

### 范围限制与剩余问题

- 交易端此次使用 admin，但当前中心没有覆盖卖家页；7 条卖家/定价路由回到了个人中心。
- 物联网此次使用 admin，20 条运营路由回到默认首页，未完成运营工作区页面验收。
- 综合服务使用 provider，部分业务接口返回 403，测到的是失败态，未完成正常数据态验收。其 27 个错误响应中有 2 个缺少详情编号导致的 404。
- 生产、物联网、资讯的部分详情页按无参数注册地址导航，产生空编号、0 或 NaN 的 400/404，不能将这种结果当成正常详情验收。生产告警复核列表还有独立的 404。
- 生产端仍有状态蓝/黄、小提示文字等低对比度候选；商城还有价格字重和浅灰说明候选；渠道商两处空态/错误提示仍为 11.5px。第三方地图版权字为 11px。
- 未做逐像素设计稿对比，不能报告差异百分比，也不能认定全量规范验收通过。
- 小程序、App 本轮未重新编译，前面编译记录对应本次优化前源码；旧的交易逐页验收记录未同步重跑，仅可作历史记录。
- 本次没有主动提交业务表单、付款、发布内容或删除记录。登录与读取请求由应用发起；检查脚本拦截未放行的写请求，不能据此保证所有读取流程都无服务端副作用。
- 项目外仅写入本轮临时检查脚本、日志与结果，设计规范文件未修改。PC 样式误改的两处已逐项撤回。

### 逐路由导航记录

“直达”仅说明 URL 未变，不代表已有正确详情参数、正常业务数据或视觉验收通过。

| 移动端 | 请求路由 | 最终路由 | 接口状态 | 备注 |
|---|---|---|---|---|
| 交易撮合 | `pages/home/index` | `#/pages/home/index` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/products/index` | `#/pages/products/index` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/product/detail` | `#/pages/product/detail` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/demands/index` | `#/pages/demands/index` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/orders/index` | `#/pages/orders/index` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/profile/index` | `#/pages/profile/index` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/publish-demand/index` | `#/pages/buyer/demand` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 交易撮合 | `pages/login/index` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 交易撮合 | `pages/match/index` | `#/pages/match/index` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/order-detail/index` | `#/pages/order-detail/index` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/contracts/index` | `#/pages/contracts/index` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/contract-detail/index` | `#/pages/contract-detail/index` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/logistics/index` | `#/pages/logistics/index` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/workspace/index` | `#/pages/workspace/index` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/business/index` | `#/pages/business/index` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/checkout/index` | `#/pages/checkout/index` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/buyer/overview` | `#/pages/buyer/overview` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/buyer/demand` | `#/pages/buyer/demand` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/buyer/inquiry` | `#/pages/buyer/inquiry` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/buyer/after` | `#/pages/buyer/after` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/buyer/fund` | `#/pages/buyer/fund` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/seller/overview` | `#/pages/profile/index` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 交易撮合 | `pages/seller/goods` | `#/pages/profile/index` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 交易撮合 | `pages/seller/quote` | `#/pages/profile/index` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 交易撮合 | `pages/seller/p2t` | `#/pages/profile/index` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 交易撮合 | `pages/seller/customer` | `#/pages/profile/index` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 交易撮合 | `pages/seller/fund` | `#/pages/profile/index` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 交易撮合 | `pages/collaboration/chat` | `#/pages/collaboration/chat` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/collaboration/agent` | `#/pages/collaboration/agent` | 未捕获4xx/5xx | 直达 |
| 交易撮合 | `pages/collaboration/price` | `#/pages/profile/index` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 交易撮合 | `pages/identity/index` | `#/pages/identity/index` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/alerts/review` | `#/pages/alerts/review` | 404 /api/v1/production/alerts/reviews?farmId=1&status=ALL&pageNum=1&pageSize=20 | 直达 |
| 生产管理 | `pages/native/analytics` | `#/pages/native/analytics` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/native/reports` | `#/pages/native/reports` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/native/import` | `#/pages/native/import` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/native/growth-analysis` | `#/pages/native/growth-analysis` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/native/exports` | `#/pages/native/exports` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/login/login` | `#/pages/workbench/workbench` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 生产管理 | `pages/register/register` | `#/pages/register/register` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/workbench/workbench` | `#/pages/workbench/workbench` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/plots/plots` | `#/pages/plots/plots` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/tasks/tasks` | `#/pages/tasks/tasks` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/harvests/harvests` | `#/pages/harvests/harvests` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/profile/profile` | `#/pages/profile/profile` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/messages/messages` | `#/pages/messages/messages` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/plots/detail` | `#/pages/plots/detail` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/plots/map` | `#/pages/plots/map` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/plots/map-embed` | `#/pages/plots/map-embed` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/plots/create` | `#/pages/plots/create` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/tasks/detail` | `#/pages/tasks/detail` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/tasks/create` | `#/pages/tasks/create` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/inputs/scan` | `#/pages/inputs/scan` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/inputs/detail` | `#/pages/inputs/detail` | 404 /api/v1/production/inputs/ | 直达 |
| 生产管理 | `pages/harvests/create` | `#/pages/harvests/create` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/harvests/detail` | `#/pages/harvests/detail` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/inventory/inventory` | `#/pages/inventory/inventory` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/trace/scan` | `#/pages/trace/scan` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/alerts/alerts` | `#/pages/alerts/alerts` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/ai/pest-detection` | `#/pages/native/business?target=%252Fproduction%252Fai%252Fpest-detection` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 生产管理 | `pages/ai/prescription` | `#/pages/native/business?target=%252Fproduction%252Fai%252Finput-safety` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 生产管理 | `pages/ai/assistant` | `#/pages/native/assistant` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 生产管理 | `pages/ai/remote-sensing` | `#/pages/native/business?target=%252Fproduction%252Fgrowth` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 生产管理 | `pages/ai/alerts` | `#/pages/native/business?target=%252Fproduction%252Falerts` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 生产管理 | `pages/ai/yield-forecast` | `#/pages/native/business?target=%252Fproduction%252Fai%252Fyield-forecast` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 生产管理 | `pages/food-safety/harvest-block` | `#/pages/food-safety/harvest-block` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/food-safety/input-ai-check` | `#/pages/food-safety/input-ai-check` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/food-safety/ai-verify` | `#/pages/native/business?target=%252Fproduction%252Ftrace%252Ffull-chain` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 生产管理 | `pages/profile/settings` | `#/pages/profile/settings` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/business/business` | `#/pages/business/business` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/workspace/workspace` | `#/pages/workbench/workbench` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 生产管理 | `pages/connection/connection` | `#/pages/connection/connection` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/native/business` | `#/pages/native/business` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/native/harvest-window` | `#/pages/native/harvest-window` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/native/calendar` | `#/pages/native/calendar` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/native/assistant` | `#/pages/native/assistant` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/native/voice` | `#/pages/native/voice` | 未捕获4xx/5xx | 直达 |
| 生产管理 | `pages/native/processing` | `#/pages/native/processing` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/index/index` | `#/pages/index/index` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/device/list` | `#/pages/device/list` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/device/detail` | `#/pages/device/detail` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/alert/list` | `#/pages/alert/list` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/plot/list` | `#/pages/plot/list` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/scene/index` | `#/pages/scene/index` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/scene/edit` | `#/pages/scene/edit` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/automation/index` | `#/pages/automation/index` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/automation/edit` | `#/pages/automation/edit` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/messages/index` | `#/pages/messages/index` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/login/index` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/account/index` | `#/pages/account/index` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/monitor/index` | `#/pages/monitor/index` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/device/edit` | `#/pages/device/edit` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/device/sampling` | `#/pages/device/sampling` | 400 /api/v1/iot/app/devices/NaN/sampling | 直达 |
| 物联网 | `pages/gateway/list` | `#/pages/gateway/list` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/gateway/detail` | `#/pages/gateway/detail` | 400 /api/v1/iot/app/gateways/NaN | 直达 |
| 物联网 | `pages/gateway/edit` | `#/pages/gateway/edit` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/plot/detail` | `#/pages/plot/detail` | 400 /api/v1/iot/app/plots/NaN/monitoring | 直达 |
| 物联网 | `pages/threshold/index` | `#/pages/threshold/index` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/threshold/edit` | `#/pages/threshold/edit` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/analytics/index` | `#/pages/analytics/index` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/maintenance/index` | `#/pages/maintenance/index` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/maintenance/create` | `#/pages/maintenance/create` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/ops/index` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/list` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/receipts` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/devices` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/gateways` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/products` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/access` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/alerts` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/rules` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/workorders` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/firmwares` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/ota` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/tenants` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/logs` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/reports` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/sampling` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/rule-edit` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/firmware-edit` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/firmware-detail` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/ops/ota-execute` | `#/` | 未捕获4xx/5xx | 发生跳转，不能视为请求页验收 |
| 物联网 | `pages/group/index` | `#/pages/group/index` | 未捕获4xx/5xx | 直达 |
| 物联网 | `pages/threshold/evaluate` | `#/pages/threshold/evaluate` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/home/index` | `#/pages/home/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/category/index` | `#/pages/category/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/cart/index` | `#/pages/cart/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/profile/index` | `#/pages/profile/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/product/detail` | `#/pages/product/detail` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/checkout/index` | `#/pages/checkout/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/orders/index` | `#/pages/orders/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/orders/detail` | `#/pages/orders/detail` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/login/index` | `#/pages/login/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/addresses/index` | `#/pages/addresses/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/addresses/edit` | `#/pages/addresses/edit` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/services/index` | `#/pages/services/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/aftersale/index` | `#/pages/aftersale/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/aftersale/apply` | `#/pages/aftersale/apply` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/channel/index` | `#/pages/channel/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/favorites/index` | `#/pages/favorites/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/footprints/index` | `#/pages/footprints/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/messages/index` | `#/pages/messages/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/member/index` | `#/pages/member/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/signin/index` | `#/pages/signin/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/points/index` | `#/pages/points/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/points/mall` | `#/pages/points/mall` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/coupons/index` | `#/pages/coupons/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/security/index` | `#/pages/security/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/logistics/index` | `#/pages/logistics/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/reviews/index` | `#/pages/reviews/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/reviews/write` | `#/pages/reviews/write` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/groups/index` | `#/pages/groups/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/groups/mine` | `#/pages/groups/mine` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/groups/detail` | `#/pages/groups/detail` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/flash/index` | `#/pages/flash/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/pay/index` | `#/pages/pay/index` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/pay/result` | `#/pages/pay/result` | 未捕获4xx/5xx | 直达 |
| 消费者商城 | `pages/aftersale/detail` | `#/pages/aftersale/detail` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/home/index` | `#/pages/home/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/products/index` | `#/pages/products/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/orders/index` | `#/pages/orders/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/profile/index` | `#/pages/profile/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/pool/index` | `#/pages/pool/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/orders/detail` | `#/pages/orders/detail` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/commissions/index` | `#/pages/commissions/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/marketing/index` | `#/pages/marketing/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/shop/edit` | `#/pages/shop/edit` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/login/index` | `#/pages/login/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/customers/index` | `#/pages/customers/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/customers/detail` | `#/pages/customers/detail` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/inventory/index` | `#/pages/inventory/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/reviews/index` | `#/pages/reviews/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/analytics/index` | `#/pages/analytics/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/reconcile/index` | `#/pages/reconcile/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/settlements/index` | `#/pages/settlements/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/notices/index` | `#/pages/notices/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/notices/preferences` | `#/pages/notices/preferences` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/procurement/index` | `#/pages/procurement/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/onboarding/index` | `#/pages/onboarding/index` | 未捕获4xx/5xx | 直达 |
| 渠道商工作台 | `pages/growth/index` | `#/pages/growth/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/news/index` | `#/pages/news/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/news/channel` | `#/pages/news/channel` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/news/article` | `#/pages/news/article` | 404 /api/v1/info/articles/0 | 直达 |
| 信息资讯 | `pages/market/index` | `#/pages/market/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/market/variety` | `#/pages/market/variety` | 400 /api/v1/info/markets/0 | 直达 |
| 信息资讯 | `pages/market/price-index` | `#/pages/market/price-index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/alert/setup` | `#/pages/alert/setup` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/alert/messages` | `#/pages/alert/messages` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/ai/index` | `#/pages/ai/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/ai/history` | `#/pages/ai/history` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/search/index` | `#/pages/search/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/message/index` | `#/pages/message/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/favorite/index` | `#/pages/favorite/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/history/index` | `#/pages/history/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/subscription/index` | `#/pages/subscription/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/profile/index` | `#/pages/profile/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/profile/edit` | `#/pages/profile/edit` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/settings/index` | `#/pages/settings/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/help/index` | `#/pages/help/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/course/index` | `#/pages/course/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/course/detail` | `#/pages/course/detail` | 400 /api/v1/info/courses/0 | 直达 |
| 信息资讯 | `pages/course/play` | `#/pages/course/play` | 400 /api/v1/info/courses/0 | 直达 |
| 信息资讯 | `pages/sd/index` | `#/pages/sd/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/sd/publish` | `#/pages/sd/publish` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/sd/detail` | `#/pages/sd/detail` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/sd/match` | `#/pages/sd/match` | 400 /api/v1/info/supply-demands/0?type=supply | 直达 |
| 信息资讯 | `pages/sd/chat` | `#/pages/sd/chat` | 400 /api/v1/info/supply-demands/0?type=supply | 直达 |
| 信息资讯 | `pages/sd/mine` | `#/pages/sd/mine` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/report/detail` | `#/pages/report/detail` | 400 /api/v1/info/reports/NaN | 直达 |
| 信息资讯 | `pages/report/mine` | `#/pages/report/mine` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/attest/index` | `#/pages/attest/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/attest/detail` | `#/pages/attest/detail` | 400 /api/v1/info/attestations/NaN | 直达 |
| 信息资讯 | `pages/attest/verify` | `#/pages/attest/verify` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/expert/apply` | `#/pages/expert/apply` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/expert/verify` | `#/pages/expert/verify` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/expert/detail` | `#/pages/expert/detail` | 400 /api/v1/info/experts/NaN | 直达 |
| 信息资讯 | `pages/expert/cert` | `#/pages/expert/cert` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/login/index` | `#/pages/login/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/knowledge/index` | `#/pages/knowledge/index` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/knowledge/detail` | `#/pages/knowledge/detail` | 400 /api/v1/info/knowledge/NaN | 直达 |
| 信息资讯 | `pages/ai/detail` | `#/pages/ai/detail` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/market/compare` | `#/pages/market/compare` | 未捕获4xx/5xx | 直达 |
| 信息资讯 | `pages/expert/index` | `#/pages/expert/index` | 未捕获4xx/5xx | 直达 |
| 综合服务 | `pages/home/index` | `#/pages/home/index` | 未捕获4xx/5xx | 直达 |
| 综合服务 | `pages/services/index` | `#/pages/services/index` | 403 /api/v1/service/providers?sort=recommended | 直达 |
| 综合服务 | `pages/provider/detail` | `#/pages/provider/detail` | 404 /api/v1/service/providers/ | 直达 |
| 综合服务 | `pages/booking/index` | `#/pages/booking/index` | 404 /api/v1/service/providers/ | 直达 |
| 综合服务 | `pages/orders/index` | `#/pages/orders/index` | 403 /api/v1/service/orders | 直达 |
| 综合服务 | `pages/orders/detail` | `#/pages/orders/detail` | 未捕获4xx/5xx | 直达 |
| 综合服务 | `pages/demand/publish` | `#/pages/demand/publish` | 403 /api/v1/service/dictionaries | 直达 |
| 综合服务 | `pages/insurance/index` | `#/pages/insurance/index` | 403 /api/v1/service/insurance/products；403 /api/v1/service/insurance/policies；403 /api/v1/service/insurance/claims | 直达 |
| 综合服务 | `pages/policies/index` | `#/pages/policies/index` | 403 /api/v1/service/policies/applications；403 /api/v1/service/policies | 直达 |
| 综合服务 | `pages/ai/index` | `#/pages/ai/index` | 未捕获4xx/5xx | 直达 |
| 综合服务 | `pages/workbench/index` | `#/pages/workbench/index` | 未捕获4xx/5xx | 直达 |
| 综合服务 | `pages/profile/index` | `#/pages/profile/index` | 403 /api/v1/service/orders；403 /api/v1/service/messages；403 /api/v1/service/policies/applications；403 /api/v1/service/certificates | 直达 |
| 综合服务 | `pages/messages/index` | `#/pages/messages/index` | 403 /api/v1/service/messages | 直达 |
| 综合服务 | `pages/login/index` | `#/pages/login/index` | 未捕获4xx/5xx | 直达 |
| 综合服务 | `pages/demand/index` | `#/pages/demand/index` | 403 /api/v1/service/demands/mine | 直达 |
| 综合服务 | `pages/feedback/index` | `#/pages/feedback/index` | 403 /api/v1/service/complaints | 直达 |
| 综合服务 | `pages/consult/index` | `#/pages/consult/index` | 403 /api/v1/service/experts；403 /api/v1/service/consultations | 直达 |
| 综合服务 | `pages/resources/index` | `#/pages/resources/index` | 403 /api/v1/service/experts；403 /api/v1/service/resources | 直达 |
| 综合服务 | `pages/training/index` | `#/pages/training/index` | 403 /api/v1/service/certificates；403 /api/v1/service/courses | 直达 |
| 综合服务 | `pages/join/index` | `#/pages/join/index` | 403 /api/v1/service/dictionaries；403 /api/v1/service/providers | 直达 |
| 综合服务 | `pages/expert/index` | `#/pages/expert/index` | 403 /api/v1/service/expert/consultations；403 /api/v1/service/expert/profile | 直达 |
| 移动执法 | `pages/workbench/index` | `#/pages/workbench/index` | 未捕获4xx/5xx | 直达 |
| 移动执法 | `pages/tasks/index` | `#/pages/tasks/index` | 未捕获4xx/5xx | 直达 |
| 移动执法 | `pages/tasks/detail` | `#/pages/tasks/detail` | 未捕获4xx/5xx | 直达 |
| 移动执法 | `pages/tasks/checklist` | `#/pages/tasks/checklist` | 未捕获4xx/5xx | 直达 |
| 移动执法 | `pages/scan/index` | `#/pages/scan/index` | 未捕获4xx/5xx | 直达 |
| 移动执法 | `pages/cases/index` | `#/pages/cases/index` | 未捕获4xx/5xx | 直达 |
| 移动执法 | `pages/cases/create` | `#/pages/cases/create` | 未捕获4xx/5xx | 直达 |
| 移动执法 | `pages/evidence/index` | `#/pages/evidence/index` | 未捕获4xx/5xx | 直达 |
| 移动执法 | `pages/messages/index` | `#/pages/messages/index` | 未捕获4xx/5xx | 直达 |
| 移动执法 | `pages/profile/index` | `#/pages/profile/index` | 未捕获4xx/5xx | 直达 |
| 移动执法 | `pages/login/index` | `#/pages/login/index` | 未捕获4xx/5xx | 直达 |
| 移动执法 | `pages/cases/detail` | `#/pages/cases/detail` | 未捕获4xx/5xx | 直达 |
| 移动执法 | `pages/evidence/detail` | `#/pages/evidence/detail` | 未捕获4xx/5xx | 直达 |
| 移动执法 | `pages/messages/detail` | `#/pages/messages/detail` | 未捕获4xx/5xx | 直达 |
| 移动执法 | `pages/warnings/detail` | `#/pages/warnings/detail` | 未捕获4xx/5xx | 直达 |

## 2026-11-20 续验 · 交易 r10，其余七端 r7

八个 H5 工程均构建发布成功。登录页采用白底品牌区，协议勾选图形与实际热区分别设置尺寸。资讯页的历史、返回、更多、添加订阅等文字操作扩展了点击区。商城分类补充已有商品时的重试入口，渠道货架补充持续显示的失败提示和重试按钮。

| 登录页（375 × 812） | HTTP | 协议热区（px） | 圆形标记宽 | 横向溢出 |
|---|---|---|---|---|
| 生产管理 | 200 | 48 × 48 | 20px | 无 |
| 交易撮合 | 200 | 48 × 48 | 20px | 无 |
| 消费者商城 | 200 | 48 × 48 | 20px | 无 |
| 渠道商工作台 | 200 | 48 × 48 | 20px | 无 |
| 信息资讯 | 200 | 48 × 48 | 20px | 无 |
| 综合服务 | 200 | 48 × 48 | 20px | 无 |
| 移动执法 | 200 | 48 × 48 | 20px | 无 |
| 物联网 | 200 | 48 × 48 | 20px | 无 |

products/index 请求失败后出现「重新加载货源」，恢复网络并点击后显示 18 个商品卡片。

商城 `pages/category/index` 在普通会员登录后实际显示 7 件商品。独立弱网测试会话跳转到登录页，本次仅确认正常加载。商城分类与渠道货架的重试入口已发布，断网再恢复的完整流程待验。

上一版复测覆盖 258 条注册路由，交易卖家、物联网运营、综合服务消费侧分别按角色检查。商城分类图标的事件在父按钮上，应测父按钮。上一版物联网对比度 22 处、生产管理 7 处、商城 3 处、渠道 8 处、服务 5 处属于历史基线。新版登录后的各角色页面、真实详情编号、全部业务文字对比度及热区尚未逐项复验，旧表不代表本次通过。此次只发布 H5，小程序和 App 的编译记录对应旧版。

回滚可用项目发布器的 --repoint 参数，交易目标 20261120-ui-v1-r9，其余七端目标 20261120-ui-v1-r6。

### 源码复核后的补丁发布

| 子系统 | 修改的页面或组件 | 发布版本 |
|---|---|---|
| iot-mobile | `components/OpsBusiness`、`pages/ops/index` | 20261120-ui-v1-r8-final |
| prod-mobile | `pages/register/register`、`pages/business/business` | 20261120-ui-v1-r8-final |
| mall-mobile | `pages/cart/index`、`pages/addresses/index`、`pages/aftersale/apply` | 20261120-ui-v1-r8-final |
| mall-channel-mobile | `pages/home/index`、`pages/orders/index`、`pages/pool/index`、`components/MobileInputSheet` | 20261120-ui-v1-r8-final |
| service-mobile | `pages/ai/index`、`pages/booking/index` | 20261120-ui-v1-r8-final |

上述端可回滚至 `20261120-ui-v1-r7`。交易仍为 r10，资讯和执法仍为 r7。补丁调整业务摘要、提示文字及小型文字操作的样式。最后一批修改后未重复逐页测量，以上登录页和重试实测对应此前的 r7/r10。


## 2026-11-20 17:55 · 生产管理登录页协议行对齐修复

针对生产管理移动端登录页中“我已阅读并同意”与《用户协议》《隐私政策》上下错位的问题，调整 `agri-production/miniprogram/src/pages/login/login.vue`：

- 将协议说明、两个协议链接及连接词“和”合并为同一行弹性布局；
- 统一各文字节点的 20px 行高和垂直居中方式；
- 窄屏允许整行自然换行；
- 保留协议勾选、用户协议和隐私政策各自的点击行为及 48px 最小触控高度；
- 补充协议链接的 disabled 状态，避免登录提交中仍可触发跳转。

### 构建与检查

- `npm run typecheck`：通过；
- `npm run build:h5`：通过；
- `npm run build:mp-weixin`：通过；
- `npm run build:app`：通过；
- H5 已发布版本：`20261120-login-consent-align-v1`，入口不变；
- H5 入口页面返回 HTTP 200，375×812 页面正常加载，协议内容已按同一行顺序显示；
- 构建仅出现项目已有的 Sass legacy JS API 与 `@import` 弃用提示，无构建错误。

本次修改了生产管理登录页源码、H5 发布产物及微信小程序/App 构建产物；没有发送验证码、登录、上传或修改业务数据。微信开发者工具真机胶囊、软键盘和实际登录流程仍未在本次检查中验证。


## 2026-11-20 · 生产管理登录页第三方入口与协议位置

- 在生产管理登录页新增微信登录、支付宝、政务服务平台三列图标入口，复用现有 static/login 图标；协议行紧随第三方入口下方，保留默认未勾选、独立协议链接和既有对齐方式。
- 三个渠道明确标注“暂未开通”，点击后显示对应接入说明；小程序提示使用手机号验证码登录。二次验证和 SSO 回调处理中不显示渠道入口，忙碌时禁用。
- **能力边界：本次完成入口 UI 和状态提示，没有实现真正的第三方授权登录。** 现有 SSO 前端也只提示未接入；服务端 SsoAccountController 的第三方绑定实现明确说明未接入 OAuth，登记外部账号不等同于授权。后续需提供微信/支付宝应用、服务端安全配置和可用回调域名，并明确所接入的政务服务平台及其协议；密钥不得放入前端。
- 类型检查、微信小程序构建、App 资源构建、H5 构建发布全部通过。仅出现原有 Sass 弃用提示。
- 生产管理 H5 发布版本：`20261120-login-third-party-v1`；前版为 `20261120-login-consent-align-v1`。常用入口不变；已有页面可能缓存旧版，本轮带版本刷新参数后加载新版成功。
- 浏览器检查：375×812 与 320×812 无横向溢出；三按钮分别约 106×112px、88×112px，均不小于 48px；协议区域位于按钮区域下方，初始未勾选。
- 交互检查：三个渠道状态说明、切换密码登录后保留入口、协议勾选均通过，无捕获到的页面脚本异常。375×812 已截图；本轮只新增入口与调整协议顺序，未进行参考图逐像素对比。
- 小程序/App 仅完成编译，未做真机验证、上传微信或生成 APK/IPA；未发送短信、提交登录或调用第三方授权，也未修改业务数据。


## 2026-11-20 · 生产管理登录卡片内容顺序调整

- 当前 H5 版本：`20261120-login-card-order-v1`，替代 `20261120-login-third-party-v1`，访问入口不变。
- 将其他登录方式、第三方入口及协议从卡片外移入同一白色登录卡片，放在密码登录/忘记密码操作行下方；随后排列验证码帮助（验证码模式）与注册账号/创建主体。卡片底部在注册行后保留20px留白。平台说明及服务连接设置仍在卡片外。
- 保留小程序首页入口、默认不勾选协议、原认证流程和第三方暂未开通提示。小程序入口页因没有密码登录切换，第三方及协议排列于入口按钮后。
- 类型检查、微信小程序、App资源构建及H5构建发布均成功；日志含原有Sass弃用提示。
- H5完成375px与320px宽度下验证码/密码状态布局及切换检查：操作行→第三方入口→协议→注册行顺序正确，协议及注册行包含在白色卡片内，注册行底部距离卡片底部20px，无横向溢出；协议可勾选及取消，无捕获到的页面脚本异常。内容超过屏高时正常纵向滚动。内置浏览器已做375×1000截图测量。本轮为位置调整，未重新做参考图逐像素对比。
- 小程序、App未做真机验证或上传，App仅资源包；未提交登录、发送短信或修改业务数据。项目外仅新增本轮临时修改及检查脚本。


## 2026-11-20 · 生产管理验证码按钮居中修正

- H5发布版本：`20261120-login-code-center-v1`，替代 `20261120-login-card-order-v1`，访问入口不变。
- 登录页 `.pl-code` 增加 flex 布局、水平及垂直居中，明确48px高度、20px行高和零内边距；获取验证码、发送中和倒计时共用此样式。按钮保持位于验证码输入框右侧，认证与发码逻辑不变。
- 类型检查、H5构建发布、微信小程序及App资源编译均成功。日志有原有Sass弃用提示。
- 内置浏览器打开新版登录页成功，完成375×1000截图；截图工具仅返回色块信息，未对文字中心偏移做数值测量。未发送验证码、提交登录或验证真实倒计时；小程序/App未真机验证、上传或生成安装包。


## 2026-11-20 · 其他七端 H5 登录页对齐生产管理

- 发布版本：七端均为 `20261120-h5-login-align-v1`。范围为交易撮合、物联网、消费者商城、渠道商工作台、信息资讯、综合服务、移动执法；生产管理保持 `20261120-login-code-center-v1`。
- H5 专用类 `h5-login-aligned.is-h5` 对齐绿色品牌横幅、浅灰背景、20px 白卡圆角、验证码按钮48px高度及水平/垂直居中。第三方入口排列在密码登录/忘记密码下方，协议紧随其后；验证码帮助以及各端已有的注册、入驻或权限说明放入白卡，保留底部20px内边距。服务连接入口保留在卡外。
- 微信登录、支付宝、政务服务平台以三列显示，分别标注“暂未开通”；复用原 channelPending 提示，不代表已接通 OAuth。原认证、MFA、找回密码、交易大厅浏览、资讯会话继续及各端权限控制保留。
- 协议使用独立48px勾选按钮、弹性换行文字和协议链接，统一20px行高；默认未勾选。模板调整使用 H5 条件编译，原小程序/App分支保留。本轮未重编小程序或App，它们仍是此前版本。
- 七端类型检查、H5构建及发布全部成功。入口不变。
- 浏览器检查：七端375px宽度的验证码/密码切换、第三方→协议的顺序、协议及已有底部入口处于白卡内、协议勾选与取消均通过，无捕获到的页面脚本异常。验证码按钮高度均48px，按钮及文字相对输入框的垂直中心偏移实测均0px。
- 320px检查：综合服务、执法通过；其余五端在动态缩窄视口后立即测量曾出现溢出标记。排查发现框架安全区测量节点已被父容器裁切；用固定320px新页面重新检查五端，页面scrollWidth均320px、登录区可见元素无越界，故未改动源码。七端密码切换与协议顺序检查通过。
- 未勾选协议时第三方按钮提示先同意协议；交易、物联网、商城、渠道、资讯在勾选协议后实测微信按钮提示未开通。支付宝、政务入口没有发起真实授权；本次没有发送验证码、提交登录、注册或修改业务数据。
- 内置浏览器打开新版商城登录页（标题“丰链云优选”），完成375×1000截图。本次参照生产管理现有页面调整，并未与原设计图片逐像素对比，不宣称像素一致；没有真机、微信内置浏览器或完整认证流程验收。
- 修改范围：七个登录页模板、已有共用登录样式文件、七端H5构建及网关发布产物，以及两份现有记录。项目外仅本任务临时检查和修改脚本。


## 2026-11-20 · 八端小程序登录首屏参照图片调整

本节更新微信小程序登录首屏；此前 H5 发布记录继续有效。参考附件为三种小程序状态设计图（默认、微信系统手机号授权弹窗、协议未勾选报错）。保留各端现有 `/static/fengchain.svg` Logo、品牌名称及副标题，未复制参考图中的公司署名。

### 实现

- 八端默认入口统一为 home：白色背景、居中品牌、62px Logo、20px品牌标题、弹性留白、底部48px绿色微信入口、其他手机号登录、圆形协议勾选及底部品牌说明。顶部根据状态栏与微信胶囊计算留白，底部适配安全区，短屏允许滚动。
- 默认不勾选协议。点击微信入口先调用原有 ensureAgreed：未勾选时协议行红色高亮、Toast及轻微抖动；勾选后清除协议错误。协议链接继续调用原有协议说明入口，正式协议全文仍须平台运营提供。
- 微信手机号快捷登录尚未接通服务端授权兑换接口：已同意协议后明确提示“微信手机号快捷登录暂未开通，请使用其他手机号登录”。没有调用 getPhoneNumber、伪造系统授权浮层或模拟登录成功。参考图的系统授权弹窗未实现。
- “其他手机号登录”进入各端已有短信表单，保留原认证、MFA及登录后跳转；可返回新首屏。小程序不提供密码登录切换。
- 页面内嵌首屏模板，共用 `packages/agri-shared/src/styles/mp-login-entry.css`，仅 MP-WEIXIN 生效。初次采用跨工程 Vue 组件触发类型与构建路径错误，已改为页内模板并删除本轮未使用组件，重新构建通过。
- 白色微信图标复用项目内移动执法现有素材，补齐其余七端；现有品牌 Logo 未修改。H5/App 未重新构建或发布。

### 验证结果

| 移动端 | 页面数 | 类型检查 | 微信小程序构建 | 页面文件缺失 |
|---|---:|---|---|---|
| 生产管理 | 46 | 通过 | 通过 | 0 |
| 交易撮合 | 31 | 通过 | 通过 | 0 |
| 物联网 | 46 | 通过 | 通过 | 0 |
| 消费者商城 | 34 | 通过 | 通过 | 0 |
| 渠道商工作台 | 22 | 通过 | 通过 | 0 |
| 信息资讯 | 43 | 通过 | 通过 | 0 |
| 综合服务 | 21 | 通过 | 通过 | 0 |
| 移动执法 | 15 | 通过 | 通过 | 0 |

- 八端构建产物的登录 WXML、WXSS 和白色微信图标齐全，全部258条注册页面的 JS/JSON/WXML/WXSS 文件齐全。
- 使用真实共享登录状态代码执行隔离测试：初始未勾选、未同意校验失败及提示、勾选清错、短信切换、返回home、小程序密码入口限制均通过。该测试不等于微信端点击或真实登录验证。
- 本轮未在微信开发者工具或真机验收画面，未与附件逐像素比较，因此不宣称与图像素一致、画面验收通过或真实微信授权可用。布局参数按参考图手机内容区设计；保留品牌导致文案与图不同。
- 未上传微信、未发送验证码、未提交登录或修改业务数据。项目外仅写入本任务临时脚本和检查日志；本轮生成的小程序产物保留在各工程原有 dist/build/mp-weixin。


## 2026-11-20 21时 · 八端微信开发者工具实际画面检查

本轮检查使用已安装的微信开发者工具 Stable 2.02.2608080、iPhone 12 系列模拟器。不是 H5 代替小程序截图，也不是仅检查编译产物。八端均尝试打开其 dist/build/mp-weixin 工程，但未能完成八端画面验收。

| 移动端 | 工程打开结果 | 实际画面与交互结果 |
|---|---|---|
| 生产管理 | 失败，code 10：不存在此 AppID | touristappid 被开发者工具拒绝，未检查实际画面 |
| 交易撮合 | CLI 返回 open 成功 | 当前窗口进入登录路由后仍显示旧手机号验证码表单；刷新及明确打开最新产物后仍未确认新版首屏，待排查实际加载工程/缓存/运行状态，不判通过 |
| 物联网 | 成功 | 新版白底首屏显示，原 Logo、名称、副标题、绿色微信入口、其他手机号入口、协议及品牌署名可见；未勾选点击微信入口时协议行/圆圈变红并出现 Toast；勾选后恢复；其他手机号入口可进入短信表单 |
| 消费者商城 | 失败，code 10：不存在此 AppID | touristappid 被拒绝，未检查实际画面 |
| 渠道商工作台 | 失败，code 10：不存在此 AppID | touristappid 被拒绝，未检查实际画面 |
| 信息资讯 | 失败，code 10：不存在此 AppID | touristappid 被拒绝，未检查实际画面 |
| 综合服务 | 失败，code 10：不存在此 AppID | touristappid 被拒绝，未检查实际画面 |
| 移动执法 | 失败，code 10：不存在此 AppID | touristappid 被拒绝，未检查实际画面 |

### 发现及边界

- 物联网首屏实际可见区域未见控件重叠；未做附件逐像素比较，未测其他模拟器尺寸或真机，不能宣称严格像素一致。
- 物联网短信表单的协议行中《隐私政策》独占第二行，且行间距偏大，记录为待优化排版问题；本轮未修改。
- 交易撮合模拟器首页提示当前预览包未连接交易服务；登录画面仍为旧短信表单。磁盘最新登录 WXML 含 mp-entry 新首屏，但这不证明模拟器实际已加载该版本，原因未定位。
- 交易与物联网编译配置使用相同 AppID；六端为 touristappid。没有为了预览复制其他项目身份或更改 AppID。需可用且有开发权限的测试配置，才能继续六端实际画面验收。
- 未验证真实微信手机号授权、发送验证码、提交登录、上传发布或修改业务数据。未变更源码、构建产物或发布版本。本轮只更新两份现有记录；项目外仅开发者工具运行及工具检查日志。

## 2026-11-20 21时 · 八端小程序协议行换行修复

针对上一轮物联网小程序实际画面中发现的协议行第二行间距偏大问题，检查八端登录页后确认原因是协议链接使用 `inline-flex` 并设置 `min-height: 48px`，在中文窄屏换行时把链接所在行撑高。此次统一调整共享登录样式：

- `packages/agri-shared/src/styles/mobile-login.css`：H5 协议链接及协议文字恢复普通内联文本流，保留协议行整体高度和左侧圆形勾选区的触控区域；窄屏下按自然文本流换行。
- `packages/agri-shared/src/styles/mp-login-entry.css`：微信小程序首屏协议文字统一为 20px 行高，并让协议文字节点保持内联，避免链接自身高度造成第二行额外空白。
- 八端均使用同一套共享规则，未修改各端现有 Logo、名称、副标题、账号认证流程、AppID、接口地址或权限。

构建与检查：交易撮合、生产管理、物联网、消费者商城、渠道商工作台、信息资讯、综合服务、移动执法八端的 `typecheck` 和 `build:mp-weixin` 均退出 0；八端构建产物均检测到新的协议样式规则。已做 320px/375px 窄屏规则级检查，确认协议文字保持内联、行高统一为 20px，未做微信开发者工具逐端截图、真机验收或参考图逐像素对比。

本轮更新了共享样式、八端微信小程序构建产物及本记录；没有修改 AppID、上传微信、发送验证码、提交登录或修改业务数据。

## 2026-11-20 21:41 · 物联网协议行开发者工具实测

在已打开的“物联网管理”微信开发者工具 iPhone 12 系列模拟器中检查，并执行编译刷新后查看：

- 快捷登录首屏：协议文字同一行显示，圆形勾选框与文字视觉对齐，未见异常换行或大行距。
- 其他手机号登录（短信表单）：《隐私政策》仍独占第二行，且第二行与首行间距明显偏大，刷新后仍存在，验收不通过。
- 源码排查线索：短信表单的“我已阅读并同意”和“和”使用 `.agree-toggle`，共享样式仍为 `inline-flex; min-width:48px; min-height:48px`。上一轮仅修复 `.agree-link`，未覆盖该节点，不能把八端短信表单判定为全部修复。该原因尚未通过修改后实测验证。
- 本轮只检查当前模拟器尺寸，未做其他尺寸、真机或参考图逐像素对比；没有发送验证码、提交登录、修改源码或重新发布产物。

本次实测补充并限定上一条“规则级检查”的结论：首屏通过；物联网短信页协议行仍需修复。


## 2026-11-20 短信登录页协议行换行修复

针对物联网小程序短信登录页中《隐私政策》换到第二行且行间距偏大的问题，复查八端短信页模板后确认原因：共享登录样式的 `.agree-toggle` 将普通协议文字设置为 `inline-flex` 并保留 `min-height: 48px`，导致窄屏换行时文字自身撑高第二行；生产管理专用短信页的 `.pl-consent-line` 及协议按钮也采用了 flex/最小高度布局。

本次修复：

- 将共享短信页协议文字改为普通内联流：`display: inline`、`min-height: 0`、`height: auto`、基线对齐；48px 触控标准继续由协议行和圆形勾选区承担。
- 将生产管理专用短信页的 `.pl-consent-line` 改为块级容器，`.pl-consent-text`、`.pl-policy` 和连接词改为普通内联流，保留原协议点击逻辑、错误变红和圆形勾选区。
- 未修改现有 Logo、名称、副标题、登录接口、协议内容、权限和 AppID。

### 本次构建与产物检查

交易撮合、生产管理、物联网、消费者商城、渠道商工作台、信息资讯、移动执法、综合服务八端均执行 `npm run typecheck` 和 `npm run build:mp-weixin`，共 8 次类型检查和 8 次微信小程序构建，全部退出 0。编译过程仅出现项目已有的 Sass 弃用提示。

八端 `dist/build/mp-weixin` 均生成登录页文件；产物级检查确认各端登录模板包含协议结构，且不存在旧的 `.agree-toggle { min-height: 48px }` 文字撑高规则。生产管理产物中的 `.pl-consent-line`、`.pl-consent-text` 和 `.pl-policy` 已编译为新的普通内联排版规则。

本轮没有在微信开发者工具逐端截图，也没有做真机、胶囊区、软键盘或实际登录验收；这里只确认了源码、构建状态和编译产物。未发送验证码、提交登录、上传微信、修改 AppID 或业务数据。


## 2026-11-20 22:03 · 生产管理小程序实际画面复验

命令行直接打开工程时被 touristappid 的“不存在此 AppID”错误拦截；图形界面导入的测试号入口也未成功。随后从开发者工具项目列表打开已有“农业生产管理”工程，成功加载 pages/login/login，并实际进入短信登录页。未修改 AppID。

- iPhone 12 系列模拟器当前尺寸：快捷登录首屏的圆形勾选框与协议文字视觉对齐，协议完整显示在同一行。
- 点击“其他手机号登录”后：短信页协议完整显示在同一行，圆形勾选框与文字视觉对齐，未再出现《隐私政策》独占第二行和大行距问题。本次为实际模拟器画面检查，非仅源码规则检查。
- 此结果仅覆盖生产管理及当前模拟器尺寸，不代表其他七端或真机验收通过；未做参考图逐像素对比。
- 保留开发者工具在生产管理短信登录页；未发送验证码、提交登录、上传发布或修改业务数据。本轮未修改源码和构建产物。


## 2026-11-21 09:27 · 小程序短信页协议勾选与文字对齐修复

用户反馈短信页圆形勾选按钮与协议文字上下不对齐。源码确认：公共短信页勾选区高 48px，圆圈位于纵向中心，但协议文字从容器顶部开始；生产管理专用 pl-consent-line 同样缺少相应偏移。

本次在共享 mp-login-entry.css 的 MP-WEIXIN 条件内增加小程序短信页规则：文字区使用 20px 行高、上下各 14px 留白，使第一行文字中心与 48px 勾选区中心均落在 24px；多行文字保持正常 20px 行距。生产管理专用短信协议行同步应用。未改变 Logo、名称、协议内容、勾选逻辑或 AppID；H5、App 未重新编译发布，其现有产物保持原状。

八端 build:mp-weixin 均返回退出码 0，并逐端确认生成的登录页 wxss 含新对齐规则。此项仅为构建产物核对，不代表八端实际画面通过。

实际模拟器核对：微信开发者工具当前物联网短信页仍显示文字偏上。Ctrl+B 刷新及 CLI 明确打开 dist/build/mp-weixin 后，显示仍未切换为当前源码对应页面（缺少当前源码中的返回登录方式入口）。因此新样式的模拟器效果未验证通过，不能宣称画面对齐已生效；尚需定位工具实际加载的工程/缓存。未继续修改源码或做额外画面重试。

本轮未发送验证码、提交登录、上传微信或修改业务数据；项目外仅写入本轮临时构建脚本与日志，并操作微信开发者工具。


## 2026-11-21 · 八端小程序短信登录页移除第三方登录

按用户要求，为交易撮合、生产管理、物联网、消费者商城、渠道商工作台、信息资讯、综合服务、移动执法八端登录模板的第三方区域增加 `#ifndef MP-WEIXIN` 条件编译，移除小程序短信页中的第三方登录标题、分隔线、微信/支付宝/政务入口与暂未开通说明。七端原有运行时隐藏判断保留，增加编译期排除；生产管理专用第三方区域同步排除。

保留现有 Logo、名称、微信快捷登录首屏、短信登录、协议及勾选逻辑。H5、App 模板对应区域仍保留，本轮未构建或发布 H5、App；未修改 AppID。

八端 `build:mp-weixin` 全部成功（退出码 0）。逐端读取新生成的登录页 WXML，确认第三方区域类名、其他登录方式标题、支付宝及政务入口均已排除，微信手机号快捷登录首屏及协议文字均仍存在。本轮未在微信开发者工具刷新截图或进行真机验收；此前记录中的模拟器旧工程/缓存问题未在本轮排查，不能将本轮产物检查作为实际画面验收。

仅修改八端登录模板、对应小程序构建产物和两份现有记录；项目外仅写入本轮临时脚本与日志。未上传微信、发送验证码、提交登录或修改业务数据。


## 2026-11-21 · 生产管理开发者工具旧画面排查及恢复

本次针对生产管理实际模拟器仍显示已移除第三方登录区域的问题进行排查。核对项目列表提示路径及工程配置，登记工程指向当前工程 dist/build/mp-weixin；磁盘登录页 WXML 已排除第三方区域，但原模拟器仍展示旧模板。未发现需要修改源码或 AppID 的证据。

处理：通过微信开发者工具 CLI 对该工程执行 cache --clean compile（成功），单独清编译缓存后原画面仍未变化；随后从开发者工具“项目 → 重新打开此项目”关闭原工程上下文，再从项目列表进入已有“农业生产管理”工程。重开后出现最新微信快捷登录首屏，点击“其他手机号登录”进入当前短信页。有效恢复步骤为清编译缓存加完整重开工程，不能仅依赖模拟器刷新。证据支持旧预览/编译上下文未更新，尚不能进一步确定工具内部哪一层缓存导致。

实际画面结果（当前 iPhone 12 系列模拟器尺寸）：
- 短信页微信、支付宝、政务平台及第三方分隔区域均已消失；仍保留“其他登录选项”这一原有切换入口，不能与第三方区域混同。
- 协议圆形勾选框与文字当前视觉位于同一水平线，协议完整显示，未见此前明显上下错位。
- 切换时画面出现一次内容为 false 的深色提示，协议也呈现红色且勾选状态；本轮没有继续定位该状态/提示问题，不能将本次画面核对表述为全部交互通过。
- 仅覆盖生产管理当前模拟器尺寸；其他七端、窄屏、真机、登录提交、验证码发送及参考图逐像素对比未在本轮验证。

未修改源码、构建产物、AppID、权限或业务数据，未重建小程序、上传微信或发布 H5/App。项目外操作仅涉及微信开发者工具该工程的编译缓存及打开状态；桌面操作授权已结束，开发者工具保留在最新短信页。本节更新此前生产管理旧画面未定位的状态，不替代其他端的验收边界。


## 2026-11-21 10:02 生产管理小程序实际画面复验

在微信开发者工具现有「农业生产管理」工程中重新编译，并操作快捷登录首屏与短信登录页。本节为此前 false 提示与协议状态修复的实际复验补充，不能将此前构建成功视为全部交互通过。

- 快捷首屏切换短信页及勾选操作过程中，未观察到页面显示 `false` 提示。开发工具数据面板中的布尔值不属于页面提示。
- 短信登录页未显示第三方登录区域，现有 Logo、名称保留。
- 首屏未勾选协议时点击快捷登录，协议行变红并显示正确的本地校验提示，没有发起授权或账号登录。
- 在首屏协议错误状态下切换到短信页，红色协议及错误文案仍然残留，当前实际画面未体现源码中的切换清理行为，需继续定位实际加载版本或运行状态。
- 短信页勾选协议后，红色与错误文案恢复正常。
- 短信页协议圆框仍高于文字基线，实际画面对齐未通过。

开发工具停留在短信登录页、协议已勾选；本轮未改源码和构建产物、未发送验证码、未提交账号登录、未上传发布。仅修改本检查记录。


## 2026-11-21 生产管理短信协议对齐与切换反馈修复（实际复验通过）

本节更新此前两项未通过状态：错误首屏切换短信页残留协议错误、短信协议圆框偏高。

- 生产管理小程序短信协议改用独立的 mp-sms-consent / mp-sms-copy 结构；文字为普通内联流、20px 行高、上下14px留白，圆框触控容器48px高。避开原 pl-policy / pl-consent-text 后置48px内联弹性规则与容器顶部留白叠加。
- 页面切换显式清除协议错误、抖动及toast；共享 mobileLogin.ts 取消待执行的抖动开始/结束定时器，勾选、切换与卸载均清理，保留用户协议选择。
- 生产管理 typecheck 与 build:mp-weixin 成功，仅有 Sass 弃用提示。
- 开发者工具出现旧模板/新脚本字段不一致，期间曾出现不属于小程序的隐私弹窗，未点击同意。仅刷新、文件缓存清理、重开工程未解决。最终使用官方 cli cache --clean compile 和 reset-fileutils 针对当前工程清理编译缓存、重置文件索引，再完整编译后加载一致的新版。
- 当前工程私有预览配置关闭 compileHotReLoad、minifyWXML、minifyWXSS、ignoreDevUnusedFiles；未修改AppID。尝试移动项目专属缓存目录被安全检查拒绝，实际未移动，未绕过限制。

实际画面复验：微信开发者工具 iPhone 12 系列模拟器，依次检查默认未勾选首屏、点击快捷登录触发本地红色协议提示、从错误首屏切入短信页、短信页勾选。切换后无红色协议、无错误文案、无页面toast；圆框与第一行文字居中对齐，协议完整单行显示；勾选正常变绿，无位置跳动，未再观察到false提示。第三方登录区域未显示，Logo和名称保留。

仅重新编译生产管理小程序。其他七端产物、H5、App仍为此前版本，未包含本次共享定时器清理改动，未重新验收。未做窄屏/真机测试、未发送验证码、未提交账号登录、未上传微信或修改业务数据。项目外涉及开发者工具当前工程编译缓存、文件索引和进程重启及临时脚本。开发者工具保留短信页、协议已勾选。


## 2026-11-21 10:24 其他七端小程序短信登录页同步

将生产管理小程序已实际验证的两项登录修复同步到交易撮合、物联网、消费者商城、渠道商工作台、信息资讯、综合服务、移动执法七端微信小程序：

- 快捷登录入口移除旧的 `aria-checked` 动态绑定，避免运行时把协议布尔状态显示为 `false`；各端原有 Logo、名称、副标题和业务登录逻辑保留。
- 短信登录页改用独立的 `mp-sms-consent` / `mp-sms-copy` 协议布局；圆形勾选按钮保留 48px 触控高度，协议文字使用普通内联流和 20px 行高，避免链接或按钮的最小高度撑大换行间距。
- 七端继续保留此前已完成的短信页第三方登录区域移除：构建产物中未发现“其他登录方式”、微信登录、支付宝、政务服务平台、第三方登录待开通或暂未开通文案。
- 共享登录状态机原有的 `openView`、`returnToLogin`、`toggleAgree` 清理逻辑继续生效：页面切换会清除协议错误、抖动及 Toast，勾选后清除协议反馈。

构建结果：七端 `typecheck` 和 `build:mp-weixin` 全部成功；仅出现项目原有 Sass 弃用提示。逐端扫描 `dist/build/mp-weixin` 登录产物均存在，新的短信协议节点已生成，协议节点没有旧的 `state.agreed` 动态绑定。

本轮只重新构建七端微信小程序，未重新构建生产管理小程序、H5 或 App，未在微信开发者工具逐端截图、未做真机验收，未上传微信、发送验证码、提交登录或修改业务数据。项目外仅写入本任务临时脚本和日志，临时文件不作为交付物。


## 2026-11-21 七端 App 资源同步更新

按用户“同步更新七端App”的要求，将交易撮合、物联网、消费者商城、渠道商工作台、信息资讯、综合服务、移动执法当前源码重新构建为 App 资源，更新各工程 `dist/build/app`。本轮未修改业务源码，最新共享登录状态清理逻辑随构建进入 App；MP-WEIXIN 专属首屏、短信协议布局及第三方区域排除规则仍保持条件编译，不据此声称 App 已采用小程序布局或移除第三方入口。

| 移动端 | 注册页面数 | 资源大小（KiB） | 类型检查 | App构建及核心产物检查 |
|---|---:|---:|---|---|
| 交易撮合 | 31 | 976.1 | 通过 | 通过 |
| 物联网 | 46 | 1072.5 | 通过 | 通过 |
| 消费者商城 | 34 | 965.1 | 通过 | 通过 |
| 渠道商工作台 | 22 | 889.3 | 通过 | 通过 |
| 信息资讯 | 43 | 1008.6 | 通过 | 通过 |
| 综合服务 | 21 | 906.6 | 通过 | 通过 |
| 移动执法 | 15 | 835.8 | 通过 | 通过 |

验证：7 次 typecheck、7 次 build:app 退出码均为 0；212 条源码注册路径均存在于 app-config-service.js；app-service.js、app-config-service.js、app.css、manifest.json、__uniappview.html 均存在且非空。资源大小为全部文件未压缩总量。编译日志只发现 Sass legacy-js-api 和 @import 弃用告警。

验收边界：只完成本地资源编译与静态完整性检查，未在 App 模拟器或真机运行，未实测协议交互、登录及接口连通性。未生成 APK/IPA、未上传发行、未推送更新；原有正式接口、AppID、包名、签名配置限制未在本轮处理。生产管理 App、八端 H5 和小程序均未重新构建发布。Logo、名称、账号、访问入口和业务权限未修改。项目外仅写入临时构建脚本及日志；未发送验证码、提交登录或修改业务数据。


## 2026-11-21 10:33 生产管理 App 资源同步更新

生产管理移动端 App 已基于当前源码重新构建，包含最新共享登录状态清理逻辑和生产管理登录页当前实现；小程序专用的微信入口模板仍按平台条件隔离，未直接移植到 App。

- `npm run typecheck`：通过。
- `npm run build:app`：通过；产物目录共 79 个文件，文件字节总和约 1.23 MB，登录页 CSS、App 主服务文件及页面资源均已更新。
- 构建日志只有项目已有的 Sass 弃用提示，没有构建错误。
- App 端保留现有 Logo、名称、短信登录、协议校验、密码登录切换、隐私提示及第三方登录入口实现；微信小程序短信页移除第三方区域的规则不影响 App。

本次仅更新生产管理 App 资源，未生成 APK/IPA、未上传或推送到手机，未做 App 真机运行、实际登录或授权回调验收；账号、访问地址、接口、AppID、包名和签名配置未改变。未发送验证码、提交登录或修改业务数据。


## 2026-11-21 App 登录页效果检查（静态检查，非画面验收）

范围：生产管理、交易撮合、物联网、消费者商城、渠道商、信息资讯、综合服务、移动执法八端 App。

- 已确认八端 app-service.js、manifest.json、app.css、__uniappview.html 及登录页 CSS 存在，UTF-8 读取 manifest 名称正常。此前 PowerShell 默认编码显示乱码不代表文件损坏。
- 当前 PATH、常见安装目录及进程未发现可用 ADB、Android 模拟器或 HBuilderX，当前窗口亦没有 App 运行环境。因此未运行安卓/iOS App，未检查原生软键盘、安全区、隐私弹窗、登录交互或接口连通性。
- 静态规则风险：七端共享 .agree 使用 align-items:flex-start，协议圆框在 48px 触控区中居中，而文字顶部排列，存在上下偏移风险；生产管理 .pl-consent-text / .pl-policy 的普通 inline 规则之后，仍有 inline-flex / min-height:48px 规则，窄屏换行可能撑大行距。这些仅为源码样式发现，尚未由 App 画面确认。
- App 仍保留第三方入口待开通状态；小程序专用协议布局没有直接作用于 App，不能以小程序复验结果代替 App 验收。
- 尝试以 App 条件分支和编译 CSS 生成静态预览，遇到渲染依赖不完整、浏览器路径及模板转换重复属性问题，最终未获得可靠预览和宽度测量结果。320/375/414px、协议切换、隐私状态均不能标记通过；无 App 截图或参考图差异数字。

本轮未修改登录源码、构建产物、AppID 或发布版本；仅更新检查记录，项目外新增临时检查脚本。未安装软件、发送验证码、提交登录或修改业务数据。


### 本轮 App 登录静态预览补测（后续结果优先）

修正临时模板转换器的事件属性解析后，已使用八端源码的 APP-PLUS 条件分支及现有 App 编译 CSS 生成静态预览。八端短信、密码、隐私提示三种预设状态，在320/375/414px宽度下共72组测量均未发现横向溢出。预设状态用于排版，不执行真实App登录逻辑；模板中的原生组件转换为HTML，样式去除scope属性并替换标签，因此不等同于原生WebView验收，也不作为参考图逐像素一致性的证明。

375px静态短信预览：生产管理协议首行与圆框中心差约-1.8px，其他七端约-15px（文字偏上）；页面高度约836至1051px，需要滚动。生产管理已在内置浏览器按375×1000截图；无参考图比对。本次未修改或修复App源码，协议偏移作为已复现的静态布局问题记录。

此前“静态预览转换未成功”的表述由本补测更新：转换现已成功，布局检查已完成；实际安卓/iOS运行仍受本机没有可用App运行环境限制。已尝试环境检查、App资源直接加载可行性检查、静态渲染替代路径；未安装软件或生成安装包，因为这不是本次检查要求。没有验证原生软键盘、安全区、原生交互与后端登录。项目外仅新增临时预览、截图和测量脚本，未发送验证码、提交登录或修改业务数据。


## 2026-11-21 八端 App 登录页协议行对齐修复

针对八个移动端 App 登录页中“协议选择按钮高于协议文字”的问题，统一调整共享协议样式，并同步修正生产管理登录页专用样式：

- 交易撮合、生产管理、物联网、消费者商城、渠道商工作台、信息资讯、综合服务、移动执法全部使用 48px 协议勾选热区。
- 协议文字容器统一为 48px 最小高度、上下 14px 内边距、20px 行高，使首行文字中心与 48px 勾选热区中心重合。
- 协议文本、协议链接和连接词恢复普通内联流，移除会把文字撑成 48px 的 `inline-flex` 规则；窄屏换行仍保持 20px 行距。
- 保留现有 Logo、名称、副标题、协议默认未勾选、错误提示、协议点击和登录流程；没有修改认证接口、权限、AppID 或业务数据。

构建结果：八端 `typecheck` 和 `build:app` 均退出 0，共 8 次类型检查、8 次 App 构建成功。构建过程只有项目原有的 Sass 弃用提示，没有构建错误。最新资源已写入各端 `dist/build/app`。

静态复验：逐端读取最新 App CSS 产物，确认新协议容器规则存在，旧的协议文字 `inline-flex + 48px` 规则已消失；按 320px、375px、414px 三种宽度检查，均未发现横向溢出。勾选圆框与协议首行文字的理论中心差为 0px。

本节属于源码、构建产物和静态布局复验，不等同于 Android/iOS 真机验收；尚未验证原生安全区、软键盘、不同系统字体和实际登录交互。未生成 APK/IPA、未安装到手机、未发送验证码或提交登录。

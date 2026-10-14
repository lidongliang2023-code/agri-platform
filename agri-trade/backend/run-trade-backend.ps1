<#
.SYNOPSIS
    启动交易撮合后端（agri-trade，默认端口 8089，连 MySQL 的 agri_trade 库）。

.DESCRIPTION
    为什么是"先打包、再用 java -jar 起"，而不是 `mvn spring-boot:run`：
    在这台机器上 `spring-boot:run` 有两处不稳 ——
      1) 它会先把编译状态写到 target/maven-status/**/*.lst，而那个文件会被后台的
         文件扫描程序持续占住，第二次编译就报 "Error while storing the mojo status"；
      2) 通过 Start-Process 把它放到后台时，mvn.cmd → cmd → java 这条链活不下来
         （进程链退出后应用跟着没了），而直接 java -jar 与 core-platform 一样稳稳常驻。
    打包 + java -jar 两步都很确定，所以脚本就走这条路。

    两个反复踩过的坑也已内置：
    1. Maven 的 user.home 在受限环境里可能解析成 C:\，于是去找 C:\.m2\repository 并报
       "Could not create local repository"；真正的本地仓库在 C:\maven\repository
       （由 %USERPROFILE%\.m2\settings.xml 指定）。这里显式带 -s 兜住。
    2. 应用启动时会执行 schema.sql（spring.sql.init.mode=always）。改了建表语句不重启，
       表就不会被建出来 —— 接口 200 但表不存在。

    端口用环境变量 SERVER_PORT 传，不用 -D 参数拼接：`-Dspring-boot.run.arguments="..."`
    在 PowerShell → mvn.cmd 的链路里会被空格拆开，实测应用收到的参数是空的，
    于是回落到 Spring Boot 默认端口 8080（正好是 nginx 的端口）。

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\run-trade-backend.ps1
#>
param(
    # 端口与数据源在 application.yml 里已经写好（8089 / agri_trade / root）。
    # 这里仍然留成参数，是为了换环境时不必改文件——但**用环境变量传，不用 -D 参数拼接**：
    # `-Dspring-boot.run.arguments="--server.port=8089 --spring.profiles.active=mysql ..."`
    # 这种写法在 PowerShell → mvn.cmd 的链路里会被空格拆开，实测应用收到的参数是空的，
    # 于是回落到 Spring Boot 的默认端口 8080（正好是 nginx 的端口），报
    # "Port 8080 was already in use"，而日志里看不出"参数没传进去"这件事。
    [int]$Port = 8089,
    [string]$DatasourcePassword = 'root',
    [string]$Profile = 'mysql'
)

$ErrorActionPreference = 'Stop'
# 用 $PSScriptRoot 取脚本所在目录：-File 调用下它一定非空，
# 而 Join-Path (Get-Location) 那种写法在某些调用路径下会拿到空值，
# 于是 Test-Path 直接抛 "无法将参数绑定到参数 Path" 把整个脚本中止。
$backendDir = $PSScriptRoot
if (-not $backendDir) { $backendDir = (Get-Location).Path }
Set-Location $backendDir

$env:SERVER_PORT = "$Port"
$env:SPRING_PROFILES_ACTIVE = $Profile
$env:SPRING_DATASOURCE_PASSWORD = $DatasourcePassword

# 绕开一个环境问题：maven-compiler-plugin 写完 target/maven-status/**/inputFiles.lst 之后，
# 这个文件会被机器上某个后台进程（文件扫描/索引一类的常驻程序）持续占住，下一次编译
# 就会报 "Error while storing the mojo status: ... 另一个程序正在使用此文件"。
# 表现很迷惑：**删掉这个文件后立刻重跑就能编译成功一次**，之后再跑又失败。
# 这里每次启动前先清掉这两个状态文件；它们只是增量编译的缓存，删掉不影响产物。
$statusDir = Join-Path $backendDir 'target\maven-status\maven-compiler-plugin\compile\default-compile'
# 整段都不许抛错：删不掉也不能因此起不来后端
Get-ChildItem -LiteralPath $statusDir -Filter '*.lst' -ErrorAction SilentlyContinue |
    Remove-Item -Force -ErrorAction SilentlyContinue

$mavenArgs = @('-o', '-DskipTests', 'spring-boot:run')
$mavenSettings = Join-Path $env:USERPROFILE '.m2\settings.xml'
if (Test-Path $mavenSettings) {
    $mavenArgs += @('-s', $mavenSettings)
}

# 编译（含资源拷贝）——不用 package：spring-boot 的 repackage 在这台机器上会被后台进程
# 占住产物文件而失败（"Execution repackage ... failed"），而 compile 一路稳定。
$compileArgs = $mavenArgs -ne 'spring-boot:run'
$compileArgs += @('compile')

Write-Host "编译交易撮合后端（profile $Profile）…"
& mvn @compileArgs
if ($LASTEXITCODE -ne 0) {
    throw "编译失败，已中止启动。"
}

# 依赖 classpath：缓存成 target\cp.txt
#
# 缓存判据**不能只看"文件在不在"**：pom.xml 改了依赖、而 cp.txt 还是旧的，
# 运行时 classpath 就缺那个 jar —— 表现是"代码编译通过、启动正常、新加的组件却完全没生效"。
# 实测踩过一次：给交易模块加 agri-common（运营端鉴权组件）后重启，RBAC 拦截器没有任何反应，
# 因为 cp.txt 是改 pom 之前生成的，agri-common 压根不在运行时 classpath 上。
# 这里按"pom.xml 是否比 cp.txt 新"决定要不要重算。
$cpFile = Join-Path $backendDir 'target\cp.txt'
$pomFile = Join-Path $backendDir 'pom.xml'
$staleCp = (-not (Test-Path $cpFile)) -or
    ((Get-Item $pomFile).LastWriteTime -gt (Get-Item $cpFile).LastWriteTime)
if ($staleCp) {
    Write-Host "解析依赖 classpath…"
    Remove-Item -LiteralPath $cpFile -Force -ErrorAction SilentlyContinue
    & mvn -o -q dependency:build-classpath "-Dmdep.outputFile=target\cp.txt" @mavenArgs[1..($mavenArgs.Count-1)]
    if (-not (Test-Path $cpFile)) {
        throw "无法生成依赖 classpath（$cpFile）"
    }
}
$deps = (Get-Content $cpFile -Raw).Trim()

Write-Host "启动交易撮合后端：端口 $Port（配置文件里的 server.port 同值）"
& java -cp ((Join-Path $backendDir 'target\classes') + ';' + $deps) com.agri.trade.TradeApplication

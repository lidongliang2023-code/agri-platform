<#
.SYNOPSIS
    本地一键启动交易、门户与生产管理依赖的整套运行环境（依赖 + 后端 + 网关）。

.DESCRIPTION
    本机这套东西**没有**做成 Windows 服务（除 Redis 有服务注册但常起不来），
    重开机后要按依赖顺序手动拉起。这个脚本把顺序与那些坑固定下来，可重复执行：
    已经在跑的组件直接跳过，只补没起来的。

    顺序（依赖在前）：
      MySQL(3306) → Redis(6379) → core-platform(8093) → agri-trade(8089)
      → agri-masterdata(8083) → agri-production(8092)
      → nginx(80/8080/8086/8090/8098/8180/8190)

    踩过的坑（脚本里都处理了）：
      1. MySQL 不是服务，要用 my.ini 启动；`--defaults-file` 的路径带空格，
         **必须用引号包住整段**，否则 mysqld 会把路径截断在空格处、报
         "Failed to open required defaults file"。
      2. Redis 的服务用当前会话起不动（Cannot open 'Redis' service），
         改为直接跑 `C:\Redis\redis-server.exe` 带配置文件。
      3. core-platform 的库口令默认是 `root123`（application.yml 的 `${MYSQL_PASSWORD:root123}`），
         而本机 MySQL 的 root 口令是 `root` —— 必须带 `MYSQL_PASSWORD=root` 启动，
         否则启动即失败：`Access denied for user 'root'@'localhost'`。
      4. nginx 的 prefix **必须用 ASCII 路径**（仓库路径含中文与括号，nginx 解析不了），
         所以走 `C:\Users\<你>\agri-gw` 这个 junction。且 nginx 在前台会占住终端，
         要用 Start-Process 脱离式启动。

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\ops\local\start-production-stack.ps1
#>

param(
    [string]$RepoRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
    [string]$MysqlRootPassword = 'root',
    [string]$GatewayPrefix = "$env:USERPROFILE\agri-gw"
)

$ErrorActionPreference = 'Stop'
$mysqlBin = 'C:\Program Files\MySQL\MySQL Server 8.4\bin'
$mysqlIni = 'C:\ProgramData\MySQL\MySQL Server 8.4\my.ini'
$redisExe = 'C:\Redis\redis-server.exe'
$redisConf = 'C:\Redis\redis.windows.conf'
$nginxExe = 'C:\nginx\nginx.exe'

function Test-Port([int]$Port) {
    # 不依赖 NetTCPIP 模块：部分受限 PowerShell/Windows 环境里
    # Get-NetTCPConnection 会被策略禁用，导致"端口明明在监听却反复启动第二份进程"。
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        return $async.AsyncWaitHandle.WaitOne(350) -and $client.Connected
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Wait-Port([int]$Port, [int]$TimeoutSec, [string]$What) {
    for ($i = 0; $i -lt $TimeoutSec; $i++) {
        if (Test-Port $Port) { Write-Host "  ✓ $What 已就绪（:$Port）"; return $true }
        Start-Sleep -Seconds 1
    }
    Write-Warning "  ✗ $What 在 $TimeoutSec 秒内没有监听 :$Port，请看日志"
    return $false
}

Write-Host '== 1/7 MySQL（:3306）=='
if (Test-Port 3306) {
    Write-Host '  · 已在运行，跳过'
} else {
    Start-Process -FilePath "$mysqlBin\mysqld.exe" `
        -ArgumentList "--defaults-file=`"$mysqlIni`"" `
        -WindowStyle Hidden `
        -RedirectStandardOutput "$env:TEMP\agri-mysqld.out.log" `
        -RedirectStandardError "$env:TEMP\agri-mysqld.err.log"
    [void](Wait-Port 3306 30 'MySQL')
}

Write-Host '== 2/7 Redis（:6379）=='
if (Test-Port 6379) {
    Write-Host '  · 已在运行，跳过'
} else {
    Start-Process -FilePath $redisExe -ArgumentList $redisConf -WindowStyle Hidden
    [void](Wait-Port 6379 15 'Redis')
}

Write-Host '== 3/7 core-platform（:8093，认证与平台域）=='
if (Test-Port 8093) {
    Write-Host '  · 已在运行，跳过'
} else {
    # 口令必须是本机 MySQL 的真实口令：core-app 的默认值是 root123，本机是 root
    $env:MYSQL_PASSWORD = $MysqlRootPassword
    $env:AGRI_CERTIFICATION_UPLOAD_DIR = Join-Path $RepoRoot 'core-platform\uploads\platform\certification'
    $coreApp = Join-Path $RepoRoot 'core-platform\core-app\target'
    Start-Process -FilePath 'java' -ArgumentList @('-jar', 'core-app-1.0.0.jar', '--server.port=8093') `
        -WorkingDirectory $coreApp -WindowStyle Hidden `
        -RedirectStandardOutput "$env:TEMP\agri-core-8093.out.log" `
        -RedirectStandardError "$env:TEMP\agri-core-8093.err.log"
    [void](Wait-Port 8093 90 'core-platform')
}

Write-Host '== 4/7 agri-trade（:8089，交易、商品详情与大厅）=='
if (Test-Port 8089) {
    Write-Host '  · 已在运行，跳过'
} else {
    $tradeApp = Join-Path $RepoRoot 'agri-trade\backend\target\agri-trade-1.0.0-SNAPSHOT.jar'
    if (-not (Test-Path $tradeApp)) {
        throw "交易后端 JAR 不存在：$tradeApp（先执行 Maven package）"
    }
    $tradeDir = Split-Path -Parent $tradeApp
    $env:MYSQL_USERNAME = 'root'
    $env:MYSQL_PASSWORD = $MysqlRootPassword
    $env:AGRI_TRADE_UPLOAD_DIR = Join-Path $RepoRoot 'agri-trade\backend\uploads'
    Start-Process -FilePath 'java' `
        -ArgumentList @('-jar', $tradeApp, '--server.port=8089') `
        -WorkingDirectory $tradeDir -WindowStyle Hidden `
        -RedirectStandardOutput "$env:TEMP\agri-trade-8089.out.log" `
        -RedirectStandardError "$env:TEMP\agri-trade-8089.err.log"
    [void](Wait-Port 8089 90 'agri-trade')
}

Write-Host '== 5/7 agri-masterdata（:8083，主数据管理运营后端）=='
if (Test-Port 8083) {
    Write-Host '  · 已在运行，跳过'
} else {
    $mdmApp = Join-Path $RepoRoot 'agri-master-data\backend\target\agri-master-data-1.0.0.jar'
    if (-not (Test-Path $mdmApp)) {
        throw "主数据后端 JAR 不存在：$mdmApp（先执行 Maven package）"
    }
    $mdmDir = Split-Path -Parent $mdmApp
    $env:SPRING_DATASOURCE_USERNAME = 'root'
    $env:SPRING_DATASOURCE_PASSWORD = $MysqlRootPassword
    Start-Process -FilePath 'java' `
        -ArgumentList @('-jar', $mdmApp, '--server.port=8083') `
        -WorkingDirectory $mdmDir -WindowStyle Hidden `
        -RedirectStandardOutput "$env:TEMP\agri-masterdata-8083.out.log" `
        -RedirectStandardError "$env:TEMP\agri-masterdata-8083.err.log"
    [void](Wait-Port 8083 90 'agri-masterdata')
}

Write-Host '== 6/7 agri-production（:8092，生产管理模块后端）=='
if (Test-Port 8092) {
    Write-Host '  · 已在运行，跳过'
} else {
    $prodBackend = Join-Path $RepoRoot 'agri-production\backend'
    Start-Process -FilePath 'java' `
        -ArgumentList @('-jar', 'target\agri-production-1.0.0-SNAPSHOT.jar', '--server.port=8092') `
        -WorkingDirectory $prodBackend -WindowStyle Hidden `
        -RedirectStandardOutput "$env:TEMP\agri-production-8092.out.log" `
        -RedirectStandardError "$env:TEMP\agri-production-8092.err.log"
    [void](Wait-Port 8092 90 'agri-production')
}

Write-Host '== 7/7 统一网关 nginx（:80 / :8080 / :8086 / :8090 / :8098 / :8180 / :8190）=='
if (Test-Port 80) {
    Write-Host '  · 已在运行，跳过'
} else {
    if (-not (Test-Path $GatewayPrefix)) {
        throw "网关 prefix 不存在：$GatewayPrefix（仓库路径含中文，nginx 需要 ASCII junction，见脚本注释）"
    }
    & $nginxExe -p $GatewayPrefix -c conf/nginx.conf -t | Out-Null
    # nginx 在 Windows 上是控制台程序：不脱离会占住当前终端
    Start-Process -FilePath $nginxExe -ArgumentList @('-p', $GatewayPrefix, '-c', 'conf/nginx.conf') -WindowStyle Hidden
    [void](Wait-Port 80 15 'nginx')
}

Write-Host ''
Write-Host '启动完成，访问地址：'
Write-Host '  官网门户        http://localhost:8098/portal/'
Write-Host '  交易大厅        http://localhost:8098/portal/#/hall'
Write-Host '  商品详情        http://localhost:8086/product/detail/7005'
Write-Host '  买家中心        http://localhost:8086/member/buyer'
Write-Host '  卖家中心        http://localhost:8086/member/seller'
Write-Host '  统一认证        http://localhost:8090/login'
Write-Host '  主数据运营端    http://localhost:8080/user/list'
Write-Host '  用户端（农户）  http://localhost:8180/    → 登录后 http://localhost/production/login'
Write-Host '  运营端（平台）  http://localhost:8190/    → 登录后 http://localhost:8190/admin/login'
Write-Host '  后端直连（调试）http://localhost:8092/api/v1/production'
Write-Host '  账号：farmer / Admin@123（用户端）、admin / Admin@123（运营端）'

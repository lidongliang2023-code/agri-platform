<#
.SYNOPSIS
    本地一键启动「生产管理模块」整套运行环境（依赖 + 后端 + 网关）。

.DESCRIPTION
    本机这套东西**没有**做成 Windows 服务（除 Redis 有服务注册但常起不来），
    重开机后要按依赖顺序手动拉起。这个脚本把顺序与那些坑固定下来，可重复执行：
    已经在跑的组件直接跳过，只补没起来的。

    顺序（依赖在前）：
      MySQL(3306) → Redis(6379) → core-platform(8093) → agri-production(8092) → nginx(80/8180/8190)

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
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Wait-Port([int]$Port, [int]$TimeoutSec, [string]$What) {
    for ($i = 0; $i -lt $TimeoutSec; $i++) {
        if (Test-Port $Port) { Write-Host "  ✓ $What 已就绪（:$Port）"; return $true }
        Start-Sleep -Seconds 1
    }
    Write-Warning "  ✗ $What 在 $TimeoutSec 秒内没有监听 :$Port，请看日志"
    return $false
}

Write-Host '== 1/5 MySQL（:3306）=='
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

Write-Host '== 2/5 Redis（:6379）=='
if (Test-Port 6379) {
    Write-Host '  · 已在运行，跳过'
} else {
    Start-Process -FilePath $redisExe -ArgumentList $redisConf -WindowStyle Hidden
    [void](Wait-Port 6379 15 'Redis')
}

Write-Host '== 3/5 core-platform（:8093，认证与平台域）=='
if (Test-Port 8093) {
    Write-Host '  · 已在运行，跳过'
} else {
    # 口令必须是本机 MySQL 的真实口令：core-app 的默认值是 root123，本机是 root
    $env:MYSQL_PASSWORD = $MysqlRootPassword
    $coreApp = Join-Path $RepoRoot 'core-platform\core-app\target'
    Start-Process -FilePath 'java' -ArgumentList @('-jar', 'core-app-1.0.0.jar', '--server.port=8093') `
        -WorkingDirectory $coreApp -WindowStyle Hidden `
        -RedirectStandardOutput "$env:TEMP\agri-core-8093.out.log" `
        -RedirectStandardError "$env:TEMP\agri-core-8093.err.log"
    [void](Wait-Port 8093 90 'core-platform')
}

Write-Host '== 4/5 agri-production（:8092，生产管理模块后端）=='
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

Write-Host '== 5/5 统一网关 nginx（:80 / :8080 / :8180 / :8190）=='
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
Write-Host '  用户端（农户）  http://localhost:8180/    → 登录后 http://localhost/production/login'
Write-Host '  运营端（平台）  http://localhost:8190/    → 登录后 http://localhost:8190/admin/login'
Write-Host '  后端直连（调试）http://localhost:8092/api/v1/production'
Write-Host '  账号：farmer / Admin@123（用户端）、admin / Admin@123（运营端）'

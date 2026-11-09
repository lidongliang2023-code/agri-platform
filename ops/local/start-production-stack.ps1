<#
.SYNOPSIS
    启动本机依赖、15 个后端与网关；重复运行只补启动缺失实例。
.DESCRIPTION
    不构建、不停止现有进程。健康检查失败返回退出码 1，成功返回 0。
    日志持久保存在 ops/local/logs；密码优先使用 MYSQL_PASSWORD 环境变量。
.EXAMPLE
    .\ops\local\start-production-stack.ps1
.EXAMPLE
    .\ops\local\start-production-stack.ps1 -CheckOnly
.EXAMPLE
    .\ops\local\start-production-stack.ps1 -Services agri-ai,satellite-iot -SkipGateway
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = '',
    [string]$MysqlRootPassword = $(if ($env:MYSQL_PASSWORD) { $env:MYSQL_PASSWORD } else { 'root' }),
    [string]$GatewayPrefix = "$env:USERPROFILE\agri-gw",
    [string[]]$Services = @(),
    [switch]$CheckOnly,
    [switch]$SkipGateway,
    [ValidateRange(5,300)][int]$TimeoutSec = 90,
    [string]$LogDirectory = '',
    # 仅清理巡检汇总日志；0 表示永久保留。
    [ValidateRange(0,36500)][int]$LogRetentionDays = 30
)
$ErrorActionPreference = 'Stop'
if (!$RepoRoot) {
    if ($PSScriptRoot) { $RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot) }
    elseif (Test-Path 'ops/local/start-production-stack.ps1') { $RepoRoot = (Get-Location).Path }
    else { throw '请用 -RepoRoot 指定项目根目录' }
}
$RepoRoot = (Resolve-Path $RepoRoot).Path
if (!$LogDirectory) { $LogDirectory = Join-Path $RepoRoot 'ops/local/logs' }
# 仅记录检查输出，不记录启动命令、环境变量或数据库密码。
New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
$runStarted = Get-Date
$runMode = if ($CheckOnly) { 'health-check' } else { 'startup-check' }
$runLog = Join-Path $LogDirectory ("{0}-{1}-{2}.log" -f $runMode,$runStarted.ToString('yyyyMMdd-HHmmss-fff'),([Guid]::NewGuid().ToString('N').Substring(0,8)))
$runLog = [IO.Path]::GetFullPath($runLog)
$logEncoding = New-Object System.Text.UTF8Encoding($true)
[IO.File]::WriteAllText($runLog,"巡检开始：$($runStarted.ToString('yyyy-MM-dd HH:mm:ss'))`r`n模式：$runMode`r`n",$logEncoding)
function Write-CheckMessage {
    param([string]$Message = '', [ConsoleColor]$ForegroundColor = [ConsoleColor]::Gray)
    Write-Host $Message -ForegroundColor $ForegroundColor
    [IO.File]::AppendAllText($runLog,$Message + [Environment]::NewLine,$logEncoding)
}
Write-CheckMessage "本次检查日志：$runLog"
function Remove-ExpiredCheckLogs {
    param([string]$Directory, [int]$RetentionDays, [string]$CurrentLog)
    if ($RetentionDays -eq 0) {
        Write-CheckMessage '日志保留策略：永久保留，自动清理已关闭。'
        return
    }
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    Write-CheckMessage "日志保留策略：保留 $RetentionDays 天，仅清理巡检汇总日志（按最后修改时间）。"
    $removed = 0
    $warnings = 0
    try {
        $candidates = @(Get-ChildItem -LiteralPath $Directory -File -ErrorAction Stop | Where-Object {
            $_.Name -cmatch '^(health-check|startup-check)-[0-9]{8}-[0-9]{6}-[0-9]{3}-[0-9a-f]{8}\.log$' -and
            $_.FullName -ne $CurrentLog -and $_.LastWriteTime -lt $cutoff -and
            !($_.Attributes -band [IO.FileAttributes]::ReparsePoint)
        })
        foreach ($file in $candidates) {
            try {
                Remove-Item -LiteralPath $file.FullName -ErrorAction Stop
                $removed++
                Write-CheckMessage "[日志清理] 已删除过期巡检日志：$($file.Name)"
            } catch {
                $warnings++
                Write-CheckMessage "[日志清理警告] 无法删除 $($file.Name)，已保留，不影响巡检。" -ForegroundColor Yellow
            }
        }
    } catch {
        $warnings++
        Write-CheckMessage '[日志清理警告] 无法读取日志目录，本次跳过清理。' -ForegroundColor Yellow
    }
    Write-CheckMessage "日志清理汇总：删除 $removed 个，警告 $warnings 项；服务运行日志不参与清理。"
}
$runCompleted = $false
$results = New-Object 'System.Collections.Generic.List[object]'
function Record($Name,$State,$Detail) {
    $results.Add([pscustomobject]@{Service=$Name;State=$State;Detail=$Detail})
    Write-CheckMessage "[$State] $Name : $Detail"
}
function Test-Port([int]$Port) {
    $c = New-Object Net.Sockets.TcpClient
    try { $a=$c.BeginConnect('127.0.0.1',$Port,$null,$null); return ($a.AsyncWaitHandle.WaitOne(350) -and $c.Connected) }
    catch { return $false } finally { $c.Dispose() }
}
Add-Type -AssemblyName System.Net.Http
function Get-LocalResponse([string]$Url, [int]$Seconds = 3) {
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.UseProxy = $false
    $client = New-Object System.Net.Http.HttpClient($handler)
    $client.Timeout = [TimeSpan]::FromSeconds($Seconds)
    try {
        $response = $client.GetAsync($Url).GetAwaiter().GetResult()
        try { return [pscustomobject]@{ StatusCode=[int]$response.StatusCode; Content=$response.Content.ReadAsStringAsync().GetAwaiter().GetResult() } }
        finally { $response.Dispose() }
    } finally { $client.Dispose() }
}
function Explain-Probe([int]$StatusCode,[string]$Content,[string]$Path) {
    switch ($StatusCode) {
        404 { return "$Path HTTP 404：探针不存在；核对端口、Actuator 依赖及运行包版本，部署新版后再检查。" }
        401 { return "$Path HTTP 401：健康端点被登录校验拦截；检查安全配置，仅开放必要健康端点，不要放开业务接口。" }
        403 { return "$Path HTTP 403：健康端点被权限校验拦截；检查安全规则与网关路由。" }
        503 { return "$Path HTTP 503：应用或依赖未就绪；查看对应服务日志，重点检查数据库、Redis 连接和启动异常。" }
    }
    if ($StatusCode -ge 500) { return "$Path HTTP $StatusCode：服务内部异常；检查异常日志、健康组件及异常处理器。" }
    if ($StatusCode -ne 200) { return "$Path HTTP $StatusCode：非预期响应；检查服务端口、重定向和路由。" }
    try { $health=$Content | ConvertFrom-Json -ErrorAction Stop } catch { return "$Path HTTP 200 但非健康 JSON；可能访问了前端或错误服务，请核对端口。" }
    if ($health.status -ne 'UP') {
        $status=[string]$health.status
        if (!$status) { $status='缺少 status' }
        return "$Path 状态 $status：检查服务依赖及启动日志；端口可连接不代表业务就绪。"
    }
    return ''
}
function Probe([int]$Port) {
    $issues=@()
    foreach ($path in @('/actuator/health','/actuator/health/liveness','/actuator/health/readiness')) {
        try {
            $r=Get-LocalResponse "http://127.0.0.1:$Port$path" 3
            $issue=Explain-Probe $r.StatusCode $r.Content $path
            if ($issue) { $issues+=$issue }
        } catch {
            $exception=$_.Exception.GetBaseException()
            if ($exception -is [System.OperationCanceledException] -or $exception.Message -match 'timeout|timed out|超时|取消') {
                $issues+="$path 请求超时（3 秒）：检查 CPU、内存、线程阻塞及依赖连接超时。"
            } else { $issues+="$path 连接或请求失败：检查监听端口、进程退出和服务日志。" }
        }
    }
    return ($issues -join '； ')
}
function Show-FailureHints {
    foreach ($result in @($results | Where-Object State -eq 'FAIL')) {
        Write-CheckMessage "`n[故障定位] $($result.Service)" -ForegroundColor Yellow
        Write-CheckMessage $result.Detail
        $entry=$catalog | Where-Object { $_[0] -eq $result.Service } | Select-Object -First 1
        $port=0
        if ($entry) { $port=[int]$entry[1] }
        elseif ($result.Service -eq 'MySQL') { $port=3306 }
        elseif ($result.Service -eq 'Redis') { $port=6379 }
        if ($port) {
            try {
                $listeners=@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
                if (!$listeners.Count) { Write-CheckMessage "端口 $port 未监听：服务未启动或已退出；检查运行包及启动错误日志，再使用启动入口补启动。" }
                foreach ($owner in @($listeners.OwningProcess | Sort-Object -Unique)) {
                    $process=Get-Process -Id $owner -ErrorAction SilentlyContinue
                    Write-CheckMessage "监听端口 $port，PID=$owner，进程=$($process.ProcessName)。如与预期服务不符，请先核实占用者，不要直接结束进程。"
                }
            } catch { Write-CheckMessage '暂未读取到监听进程信息，可结合服务日志定位。' }
        }
        if ($entry) {
            $jarPath=Join-Path $RepoRoot $entry[2]
            if (!(Test-Path $jarPath -PathType Leaf)) { Write-CheckMessage "运行包缺失：$jarPath；请构建对应模块。" }
        }
        if ($result.Service -eq 'MySQL') { Write-CheckMessage '检查 MySQL Windows 服务、数据目录及错误日志；端口检查不验证数据库账号密码。' }
        if ($result.Service -eq 'Redis') { Write-CheckMessage '检查 Redis 配置、监听端口与启动日志；端口检查不验证缓存读写。' }
        if ($result.Service -eq 'nginx') { Write-CheckMessage '检查 nginx 配置、入口端口及网关 error.log；HTTP 502/504 通常还需检查对应上游服务。' }
        $logs=@(Get-ChildItem -LiteralPath $LogDirectory -Filter "$($result.Service)-*.log" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 2)
        if ($logs.Count) { foreach ($log in $logs) { Write-CheckMessage "最近日志：$($log.FullName)" } }
        else { Write-CheckMessage '未找到本脚本生成的持久日志；若由其他方式启动，请查看该启动方式的输出日志。' }
    }
}
function Launch($Exe,$Arguments,$WorkingDir,$Name,$Environment) {
    New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
    $stamp=Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $saved=@{}
    try {
        foreach ($key in $Environment.Keys) {
            $saved[$key]=[Environment]::GetEnvironmentVariable($key,'Process')
            [Environment]::SetEnvironmentVariable($key,$Environment[$key],'Process')
        }
        return Start-Process -FilePath $Exe -ArgumentList $Arguments -WorkingDirectory $WorkingDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $LogDirectory "$Name-$stamp.out.log") -RedirectStandardError (Join-Path $LogDirectory "$Name-$stamp.err.log")
    } finally {
        foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key,$saved[$key],'Process') }
    }
}
function Dependency($Name,$Port,$Exe,$Arguments,$WorkingDir) {
    if (Test-Port $Port) { Record $Name 'OK' "端口 $Port 已监听"; return $true }
    if ($CheckOnly) { Record $Name 'FAIL' '未运行'; return $false }
    try {
        $proc=Launch $Exe $Arguments $WorkingDir $Name @{}
        $deadline=(Get-Date).AddSeconds(30)
        do {
            if (Test-Port $Port) { Record $Name 'OK' '已启动'; return $true }
            if ($proc.HasExited) { throw "进程退出，退出码 $($proc.ExitCode)" }
            Start-Sleep -Milliseconds 500
        } while ((Get-Date) -lt $deadline)
        throw '等待端口超时'
    } catch { Record $Name 'FAIL' $_.Exception.Message; return $false }
}
# 清单与统一监控的固定端口一致；显式 profile 避免落到内存数据库。
$catalog=@(
    @('core-platform',8093,'core-platform/core-app/target/core-app-1.0.0.jar',''),
    @('agri-trade',8089,'agri-trade/backend/target/agri-trade-1.0.0-SNAPSHOT.jar','mysql'),
    @('agri-finance',8087,'agri-finance/backend/target/agri-finance-1.0.0-SNAPSHOT.jar','mysql'),
    @('agri-masterdata',8083,'agri-master-data/backend/target/agri-master-data-1.0.0.jar','mysql'),
    @('agri-production',8092,'agri-production/backend/target/agri-production-1.0.0-SNAPSHOT.jar','dev'),
    @('agri-iot',8091,'agri-iot/backend/target/agri-iot-platform-1.0.0.jar','mysql'),
    @('agri-s2b2c',8088,'agri-s2b2c/target/agri-s2b2c-1.0.0.jar','mysql'),
    @('agri-service',8094,'agri-service/target/agri-service-1.0.0.jar','mysql'),
    @('agri-info',8096,'agri-info/target/agri-info-1.0.0.jar','mysql'),
    @('agri-government',8095,'agri-government/target/agri-government-1.0.0.jar','mysql'),
    @('satellite-gov-exchange',8112,'core-platform/satellite-gov-exchange/target/satellite-gov-exchange-1.0.0.jar',''),
    @('agri-ai',8201,'agri-ai/target/agri-ai-1.0.0.jar','dev'),
    @('satellite-iot',8202,'core-platform/satellite-iot/target/satellite-iot-1.0.0.jar',''),
    @('satellite-ai-gateway',8203,'core-platform/satellite-ai-gateway/target/satellite-ai-gateway-1.0.0.jar',''),
    @('satellite-quote-push',8204,'core-platform/satellite-quote-push/target/satellite-quote-push-1.0.0.jar','')
)
foreach ($requested in $Services) { if ($requested -notin @($catalog | ForEach-Object { $_[0] })) { throw "未知服务：$requested" } }
# 防止同时双击脚本导致同一服务启动两份。
$mutex=New-Object Threading.Mutex($false,'Local\AgriPlatformStackStartup')
$locked=$false
try {
    try { $locked=$mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked=$true }
    if (!$locked) { throw '另一个启动脚本正在执行，请等待其结束。' }
    Remove-ExpiredCheckLogs -Directory $LogDirectory -RetentionDays $LogRetentionDays -CurrentLog $runLog
    $db=Dependency 'MySQL' 3306 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe' '--defaults-file="C:\ProgramData\MySQL\MySQL Server 8.4\my.ini"' $RepoRoot
    $cache=Dependency 'Redis' 6379 'C:\Redis\redis-server.exe' '"C:\Redis\redis.windows.conf"' 'C:\Redis'
    foreach ($s in $catalog) {
        $name,$port,$relative,$profile=$s
        # 部分启动仍先确保认证核心可用。
        if ($Services.Count -and $name -ne 'core-platform' -and $name -notin $Services) { continue }
        $jar=Join-Path $RepoRoot $relative
        $existing=Test-Port $port
        if ($existing) {
            $errorText=Probe $port
            if ($errorText) { Record $name 'FAIL' "端口已占用，不重复启动；$errorText" }
            else { Record $name 'OK' '已运行，三个探针均 UP' }
            continue
        }
        if ($CheckOnly) { Record $name 'FAIL' '未运行'; continue }
        if (!$db -or !$cache) { Record $name 'FAIL' '依赖未就绪，跳过启动'; continue }
        if (!(Test-Path $jar -PathType Leaf)) { Record $name 'FAIL' '运行包不存在，请先构建'; continue }
        try {
            $environment=@{
                MYSQL_USERNAME='root'; MYSQL_PASSWORD=$MysqlRootPassword
                SPRING_DATASOURCE_USERNAME='root'; SPRING_DATASOURCE_PASSWORD=$MysqlRootPassword
                MYSQL_HOST='localhost'; MYSQL_PORT='3306'; MYSQL_DATABASE=$null; MYSQL_URL=$null
                SPRING_PROFILES_ACTIVE=$null; SPRING_DATASOURCE_URL=$null
                CORE_BASE_URL='http://localhost:8093'
            }
            if ($name -eq 'agri-finance') { $environment.MYSQL_DATABASE='agri_finance' }
            if ($name -eq 'core-platform') { $environment.AGRI_CERTIFICATION_UPLOAD_DIR=Join-Path $RepoRoot 'core-platform/uploads/platform/certification' }
            if ($name -eq 'agri-trade') { $environment.AGRI_TRADE_UPLOAD_DIR=Join-Path $RepoRoot 'agri-trade/backend/uploads' }
            if ($name -eq 'agri-iot') {
                $environment.IOT_FIRMWARE_STORAGE_DIR=Join-Path $RepoRoot 'agri-iot/backend/data/firmware'
                $environment.IOT_FIRMWARE_PUBLIC_BASE_URL=$(if ($env:IOT_FIRMWARE_PUBLIC_BASE_URL) { $env:IOT_FIRMWARE_PUBLIC_BASE_URL } else { 'https://localhost:8443/api/v1/iot/gateway-channel/firmware' })
            }
            if ($name -eq 'satellite-gov-exchange') { $environment.GOV_EXPORT_DIR=Join-Path $RepoRoot 'core-platform/satellite-gov-exchange/gov-outbox' }
            $arguments=@('-jar',('"'+$jar+'"'),"--server.port=$port")
            if ($port -ge 8201) { $arguments=@('-Xms64m','-Xmx256m')+$arguments }
            if ($profile) { $arguments+="--spring.profiles.active=$profile" }
            if ($name -eq 'agri-production') { $arguments+="--spring.datasource.password=$MysqlRootPassword" }
            if ($name -eq 'core-platform') {
                $uri=([Uri](Join-Path $RepoRoot 'core-platform/core-app/src/main/resources/application.yml')).AbsoluteUri
                $arguments+='"--spring.config.additional-location='+$uri+'"'
            }
            $work=Split-Path $jar -Parent
            if ($name -in @('agri-production','agri-finance')) { $work=Split-Path $work -Parent }
            $proc=Launch 'java' $arguments $work $name $environment
            $deadline=(Get-Date).AddSeconds($TimeoutSec)
            $errorText='尚未监听'
            do {
                if ($proc.HasExited) { throw "进程提前退出（$($proc.ExitCode)），请查看持久日志" }
                if (Test-Port $port) { $errorText=Probe $port; if (!$errorText) { break } }
                Start-Sleep -Milliseconds 700
            } while ((Get-Date) -lt $deadline)
            if ($errorText) { throw "启动未就绪：$errorText" }
            Record $name 'OK' "已启动 PID=$($proc.Id)，三个探针均 UP"
        } catch { Record $name 'FAIL' $_.Exception.Message }
    }
    if (!$SkipGateway) {
        try {
            $nginx='C:\nginx\nginx.exe'
            if (!$CheckOnly) {
                if (!(Test-Path $GatewayPrefix)) { throw '网关目录不存在' }
                $chk = Start-Process $nginx -ArgumentList @('-p', $GatewayPrefix, '-c', 'conf/nginx.conf', '-t') -NoNewWindow -Wait -PassThru
                if ($chk.ExitCode -ne 0) { throw '网关配置检查失败' }
            }
            if (!(Test-Port 80) -and !$CheckOnly) {
                $null=Launch $nginx @('-p',('"'+$GatewayPrefix+'"'),'-c','conf/nginx.conf') $GatewayPrefix 'nginx' @{}
                $deadline=(Get-Date).AddSeconds(15)
                while (!(Test-Port 80) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
            }
            foreach ($port in @(80,8090,8098,8110,8115)) {
                $r=Get-LocalResponse "http://127.0.0.1:$port/" 5
                if ($r.StatusCode -ne 200) { throw "网关入口 $port HTTP $($r.StatusCode)：检查网关路由、静态资源和上游服务" }
            }
            Record 'nginx' 'OK' '五个主要入口 HTTP 检查通过'
        } catch { Record 'nginx' 'FAIL' $_.Exception.Message }
    }
    Write-CheckMessage "`n运行检查汇总："
    Write-CheckMessage ($results | Format-Table -AutoSize -Wrap | Out-String -Width 200)
    $failed=@($results | Where-Object State -eq 'FAIL').Count
    $runCompleted = $true
    if ($failed) { Show-FailureHints; Write-CheckMessage "$failed 项未就绪，请按汇总处理；未停止任何现有进程。"; exit 1 }
    Write-CheckMessage '所选组件全部就绪。现有服务没有重启；外部 MQTT / AI 开关沿用原配置。'
Write-CheckMessage '  官网门户        http://localhost:8098/portal/'
Write-CheckMessage '  交易大厅        http://localhost:8098/portal/#/hall'
Write-CheckMessage '  商品详情        http://localhost:8086/product/detail/7005'
Write-CheckMessage '  买家中心        http://localhost:8086/member/buyer'
Write-CheckMessage '  卖家中心        http://localhost:8086/member/seller'
Write-CheckMessage '  供应链金融      http://localhost:8081/finance/index.html'
Write-CheckMessage '  物联网用户端    http://localhost:8101/'
Write-CheckMessage '  物联网运营端    http://localhost:8102/'
Write-CheckMessage '  物联网移动端    http://localhost:8111/'
Write-CheckMessage '  S2B2C 消费者端  http://localhost:8082/'
Write-CheckMessage '  S2B2C 移动端    http://localhost:8182/'
Write-CheckMessage '  S2B2C 供应商移动端 http://localhost:8183/'
Write-CheckMessage '  S2B2C 渠道商移动端 http://localhost:8184/'
Write-CheckMessage '  S2B2C 供应商端  http://localhost:8084/'
Write-CheckMessage '  S2B2C 商家端    http://localhost:8085/'
Write-CheckMessage '  S2B2C 运营端    http://localhost:8103/'
Write-CheckMessage '  信息资讯        http://localhost:8104/'
Write-CheckMessage '  信息资讯运营端  http://localhost:8113/info-ops/'
Write-CheckMessage '  信息资讯移动端  http://localhost:8114/'
Write-CheckMessage '  综合服务用户端  http://localhost:8105/'
Write-CheckMessage '  综合服务移动端  http://localhost:8106/'
Write-CheckMessage '  综合服务运营端  http://localhost:8107/'
Write-CheckMessage '  政府监管用户端  http://localhost:8108/'
Write-CheckMessage '  政府监管移动端  http://localhost:8109/'
Write-CheckMessage '  政府监管运营端  http://localhost:8110/'
Write-CheckMessage '  统一认证        http://localhost:8090/login'
Write-CheckMessage '  主数据运营端    http://localhost:8080/user/list'
Write-CheckMessage '  生产管理移动端  http://localhost:8180/'
Write-CheckMessage '  交易撮合移动端  http://localhost:8181/'
Write-CheckMessage '  运营端（平台）  http://localhost:8190/    → 登录后 http://localhost:8190/admin/login'
Write-CheckMessage '  后端直连（调试）http://localhost:8092/api/v1/production'
    Write-CheckMessage '  用户中心运营端  http://localhost:8115/user-center-ops/'
    exit 0
} catch {
    Write-CheckMessage ("[执行异常] " + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally {
    $failedCount = @($results | Where-Object State -eq 'FAIL').Count
    $okCount = @($results | Where-Object State -eq 'OK').Count
    $finalState = if (!$runCompleted) { '异常中止，退出码 1' } elseif ($failedCount) { '存在未就绪项，退出码 1' } else { '全部通过，退出码 0' }
    Write-CheckMessage "最终结果：$finalState；通过 $okCount 项，失败 $failedCount 项。"
    Write-CheckMessage ("结束时间：{0}；耗时 {1:N1} 秒" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'),((Get-Date)-$runStarted).TotalSeconds)
    Write-CheckMessage "日志已保存：$runLog"
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}



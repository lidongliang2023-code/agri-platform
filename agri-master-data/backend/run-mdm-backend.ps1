<#
.SYNOPSIS
    启动主数据后端（运营端与用户端共用的 API 服务，默认端口 8083）。

.DESCRIPTION
    这个脚本存在的唯一理由是"重启要能一条命令重复执行"。它顺带兜住了两个每次重启都会踩的坑：

    1. Maven 的 user.home 在某些受限/沙箱环境里会解析成 C:\，于是去找 C:\.m2\repository，
       报 "Could not create local repository at C:\.m2\repository"，而真正的本地仓库在
       C:\maven\repository（由 %USERPROFILE%\.m2\settings.xml 指定）。脚本显式带上 -s。

    2. 应用启动时会执行 schema.sql（spring.sql.init.mode=always）。schema.sql 里的新表
       只有在重启之后才会真正建出来 —— 改了建表语句不重启，接口 200 但表不存在。

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\run-mdm-backend.ps1
#>
param(
    [int]$Port = 8083,
    [string]$DatasourcePassword = 'root'
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

$mavenArgs = @('-o', '-DskipTests', 'spring-boot:run')
$mavenSettings = Join-Path $env:USERPROFILE '.m2\settings.xml'
if (Test-Path $mavenSettings) {
    $mavenArgs += @('-s', $mavenSettings)
}
$mavenArgs += "-Dspring-boot.run.arguments=--server.port=$Port --spring.datasource.password=$DatasourcePassword"

Write-Host "启动主数据后端：端口 $Port"
& mvn @mavenArgs

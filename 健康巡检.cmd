@echo off
setlocal
title Agri Platform - Health Check
pushd "%~dp0"
if errorlevel 1 (
    echo [ERROR] Cannot open the project directory.
    pause
    exit /b 1
)
if not exist "%~dp0ops\local\start-production-stack.ps1" (
    echo [ERROR] Health check script not found. Keep this file in the project root.
    popd
    pause
    exit /b 1
)
echo Checking dependencies, 15 backend services and gateway.
echo Read-only mode: no services will be started or restarted.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0ops\local\start-production-stack.ps1" -RepoRoot "%~dp0." -CheckOnly
set "CHECK_EXIT=%ERRORLEVEL%"
echo.
if "%CHECK_EXIT%"=="0" (
    echo [OK] All health checks passed.
) else (
    echo [ERROR] Health check did not pass. See details above.
    echo Exit code: %CHECK_EXIT%
)
popd
pause
exit /b %CHECK_EXIT%

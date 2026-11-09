@echo off
setlocal
title Agri Platform - Start Services
pushd "%~dp0"
if errorlevel 1 (
    echo [ERROR] Cannot open the project directory.
    pause
    exit /b 1
)
if not exist "%~dp0ops\local\start-production-stack.ps1" (
    echo [ERROR] Startup script not found. Keep this file in the project root.
    popd
    pause
    exit /b 1
)
echo Starting platform services. Please keep this window open until completion.
echo Existing services will not be restarted.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0ops\local\start-production-stack.ps1" -RepoRoot "%~dp0."
set "START_EXIT=%ERRORLEVEL%"
echo.
if "%START_EXIT%"=="0" (
    echo [OK] Startup checks completed successfully.
) else (
    echo [ERROR] Some components are not ready. See details above.
    echo Exit code: %START_EXIT%
)
echo Closing this window will not stop the started services.
popd
pause
exit /b %START_EXIT%

@echo off
title Nhac - Bat Tunnel
setlocal

set "SCRIPT_PATH=%~dp0local-coding-agent\scripts\local-coding-agent.mjs"
set "WORKSPACE=%~dp0"
set "PROFILE=nhac-standalone"

echo ===================================================
echo   Khoi dong MCP Server & Tunnel cho Project Nhac
echo   Workspace: %WORKSPACE%
echo   Profile:   %PROFILE%
echo ===================================================
echo.

node "%SCRIPT_PATH%" start --workspace "%WORKSPACE%" --profile "%PROFILE%" --mode full --policy full

echo.
pause


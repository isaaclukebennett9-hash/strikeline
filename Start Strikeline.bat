@echo off
title Strikeline Server
cd /d "%~dp0"
if not exist node_modules (
  echo Installing for the first time...
  call npm install --no-audit --no-fund
)
start "" http://localhost:3080
node server.js
pause

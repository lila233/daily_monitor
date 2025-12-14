@echo off
echo Stopping Daily Monitor...

:: Find and kill the specific node process running server/index.js
wmic process where "name='node.exe' and commandline like '%%server/index.js%%'" call terminate >nul 2>&1

:: Also try to kill the parent npm process if it exists (heuristic match)
wmic process where "name='node.exe' and commandline like '%%npm%%' and commandline like '%%start%%'" call terminate >nul 2>&1



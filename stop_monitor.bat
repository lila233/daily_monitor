@echo off
echo Stopping Daily Monitor...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server\tools\StopMonitor.ps1"
echo Done.

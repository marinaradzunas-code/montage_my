@echo off
cd /d "%~dp0"
if "%~1"=="" (echo Drag a video file onto this script. & pause & exit /b 1)
.venv\Scripts\python.exe scripts\import-video.py "%~1"
if errorlevel 1 (pause & exit /b 1)
rem Imported composition opens in Remotion Studio; this window keeps the studio running.
node scripts\open-studio.cjs
pause

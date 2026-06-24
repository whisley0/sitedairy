@echo off
REM Always runs Android build from the sitedairy project folder.
cd /d "%~dp0"
node scripts\android.cjs %*

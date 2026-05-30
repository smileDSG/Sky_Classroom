@echo off
echo Initializing MySQL...
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --initialize-insecure --datadir=D:\MySQL\data --console > D:\MySQL\init.log 2>&1
echo Done. Check D:\MySQL\init.log for details.
type D:\MySQL\init.log
pause

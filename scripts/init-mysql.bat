@echo off
echo Creating MySQL data directory...
mkdir "C:\Program Files\MySQL\MySQL Server 8.0\data" 2>nul
echo Initializing MySQL data directory...
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --initialize-insecure --console
echo.
echo Done. Press any key to exit.
pause >nul

@echo off
echo Fixing MySQL data directory permissions...
icacls "C:\Program Files\MySQL\MySQL Server 8.0\data" /grant Everyone:F /T
echo.
echo Starting MySQL Server...
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --console
pause

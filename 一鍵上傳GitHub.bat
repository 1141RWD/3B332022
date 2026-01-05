@echo off
chcp 65001
echo.
echo =======================================================
echo 正在強制清除 GitHub 憑證...
echo 這將確保您可以選擇要使用的帳號進行上傳。
echo =======================================================

:: 創建臨時文件來存儲 git credential reject 的輸入
echo protocol=https> "%TEMP%\git_cred_input.txt"
echo host=github.com>> "%TEMP%\git_cred_input.txt"
echo.>> "%TEMP%\git_cred_input.txt"

:: 使用臨時文件清除憑證
type "%TEMP%\git_cred_input.txt" | git credential reject

:: 刪除臨時文件
del "%TEMP%\git_cred_input.txt"

echo.
echo 檢查 Git 狀態...
if not exist .git (
    echo 正在初始化 Git 倉庫...
    git init
) 

echo.
echo 正在添加文件...
git add .
echo 正在提交更改...
set datetime=%date% %time%
git commit -m "Auto update %datetime%"

echo 正在設置遠程倉庫...
git remote remove origin >nul 2>&1
git remote add origin https://github.com/1141RWD/3B332022

echo.
echo =======================================================
echo 即將推送到 GitHub...
echo * 系統將會彈出視窗要求您登入 GitHub *
echo * 請輸入您想要使用的帳號與密碼 (或 Token) *
echo =======================================================
git branch -M main
git push -u origin main --force

echo 完成！
pause

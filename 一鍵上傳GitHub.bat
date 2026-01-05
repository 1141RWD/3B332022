@echo off
chcp 65001
echo =======================================================
echo 正在清除舊的 GitHub 登入資訊...
echo 這將確保您可以選擇要使用的帳號進行上傳。
echo =======================================================
echo url=https://github.com | git credential reject

echo.
echo 檢查 Git 狀態...
if not exist .git (
    echo 正在初始化 Git 倉庫...
    git init
) else (
    echo Git 倉庫已存在。
)

echo.
echo 正在添加文件...
git add .
echo 正在提交更改...
set datetime=%date% %time%
git commit -m "Auto update %datetime%"

echo 正在設置遠程倉庫...
:: 嘗試移除舊的 origin，如果不存在也沒關係 (>nul 2>&1 隱藏錯誤訊息)
git remote remove origin >nul 2>&1
git remote add origin https://github.com/1141RWD/3B332022

echo.
echo =======================================================
echo 即將推送到 GitHub...
echo * 系統將會彈出視窗要求您登入 GitHub *
echo * 請輸入您想要使用的帳號與密碼 (或 Token) *
echo =======================================================
git branch -M main
git push -u origin main

echo 完成！
pause

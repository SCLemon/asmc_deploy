#!/bin/bash
set -e  # 若有指令失敗，腳本會立即停止

LOG_DIR="../logs"

# 檢查 logs 資料夾是否存在，不存在就建立
if [ ! -d "$LOG_DIR" ]; then
  echo "Log directory not found. Creating $LOG_DIR ..."
  mkdir -p "$LOG_DIR"
fi

echo "Starting HTTPS server..."
# 2>&1 把標準錯誤轉到標準輸出，再透過 tee 寫入檔案並輸出到螢幕，最後在背景執行 (&)
node ./asmc_deploy/https.js 2>&1 | tee "$LOG_DIR/https.log" &

echo "Starting Backend server for asmc..."
node ./asmc_deploy/projects/asmc/backend/index.js 2>&1 | tee "$LOG_DIR/asmc_backend.log" &


echo "All services started successfully."
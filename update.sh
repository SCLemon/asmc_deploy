#!/bin/bash
set -e

# 移除舊版本
if [ -d "asmc_deploy" ]; then
  echo "Removing previous version of asmc_deploy..."
  rm -rf asmc_deploy
fi

# 下載最新版本
echo "Downloading the latest version of asmc_deploy..."
if ! git clone --depth 1 https://github.com/SCLemon/asmc_deploy.git; then
  echo "❌ Git clone failed."
  exit 1
fi

# 安裝前端依賴
echo "Installing npm packages for asmc_deploy..."
cd asmc_deploy
npm install --legacy-peer-deps

# 安裝後端依賴
cd projects
echo "Installing npm packages for backend for asmc..."
cd asmc/backend
npm install --legacy-peer-deps

cd ../../
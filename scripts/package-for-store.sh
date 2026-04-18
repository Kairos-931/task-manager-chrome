#!/bin/bash
# 发布到 Chrome Web Store 打包脚本

echo "开始打包 Chrome 扩展..."

# 确保构建最新版本
pnpm build

cd chrome-extension-loadable

# 打包为 ZIP（排除 node_modules, scripts 等）
zip -r ../task-manager-extension.zip \
  manifest.json \
  background.js \
  popup/ \
  newtab/ \
  styles/ \
  icons/

cd ..

echo "打包完成: task-manager-extension.zip"
echo ""
echo "下一步："
echo "1. 访问 https://chrome.google.com/webstore/devconsole"
echo "2. 点击 '新增商品'"
echo "3. 上传 task-manager-extension.zip"
echo "4. 填写商品信息"
echo "5. 提交审核"

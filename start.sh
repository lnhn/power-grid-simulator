#!/bin/bash

echo "🚀 启动化工厂电网模拟系统..."

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，正在安装依赖..."
    npm install
fi

# 检查数据库是否存在
if [ ! -f "prisma/dev.db" ]; then
    echo "🗄️  初始化数据库..."
    npx prisma generate
    npx prisma db push
    
    echo "📝 填充初始数据..."
    npm run seed
fi

echo "✨ 启动开发服务器..."
npm run dev

# 数据库修复说明

## 问题
SQLite 不支持 enum 类型，已将 `role` 字段从 enum 改为 String 类型。

## 已修复
✅ prisma/schema.prisma - role 字段类型已修改

## 安装步骤（更新）

1. 安装依赖
```bash
npm install
```

2. 生成 Prisma 客户端
```bash
npx prisma generate
```

3. 推送数据库结构
```bash
npx prisma db push
```

4. 填充测试数据
```bash
npx tsx prisma/seed.ts
```

5. 启动开发服务器
```bash
npm run dev
```

访问 http://localhost:3000

## 测试账号
- 工程师：username: `engineer`, password: `password`
- 操作员：username: `operator`, password: `password`

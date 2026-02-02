# 更新日志

## v1.0.1 - 修复 Bug

### 🐛 Bug 修复
1. **修复数据解析错误** - 修复了 "nodes.forEach is not a function" 错误
   - 增加了安全的 JSON 解析
   - 确保 nodes 和 edges 始终是数组类型
   - 添加了错误处理和日志

2. **修复数据库 Schema** - SQLite enum 兼容性
   - 将 Role enum 改为 String 类型
   - 保持功能不变，兼容 SQLite

### 📝 如何更新

如果你已经下载了旧版本，有两种方式更新：

#### 方式 1: 重新下载（推荐）
1. 下载新的压缩包
2. 解压到新目录
3. 按照正常步骤安装

#### 方式 2: 手动更新文件
只需要替换以下两个文件：
- `app/grid/[id]/edit/page.tsx`
- `app/grid/[id]/simulate/page.tsx`
- `prisma/schema.prisma`

然后重新运行：
```bash
npx prisma generate
npx prisma db push
npm run dev
```

### ✅ 现在应该可以正常使用了
- ✅ 创建新电网
- ✅ 编辑电网
- ✅ 模拟运行
- ✅ 保存和加载电网

如有其他问题，请反馈！

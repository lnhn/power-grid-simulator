# 🔧 保存功能修复说明 v2.1.1

## 问题诊断

保存后变成空白的原因是**双重JSON序列化**：

### 错误流程
```
1. 前端：JSON.stringify(cleanNodes)  → "[ {...} ]"
2. API：  JSON.stringify(nodes)       → "\"[ {...} ]\""  ❌ 双重序列化！
3. 数据库：保存的是字符串的字符串
4. 读取时：JSON.parse("\"[ {...} ]\"") → "[ {...} ]" （还是字符串！）
5. 再次parse会失败 → 返回空数组
```

### 正确流程
```
1. 前端：JSON.stringify(cleanNodes)  → "[ {...} ]"
2. API：  直接保存 nodes              → "[ {...} ]"  ✅ 正确！
3. 数据库：保存的是正常JSON字符串
4. 读取时：JSON.parse("[ {...} ]")   → [ {...} ]  ✅ 正常数组
```

## 已修复

### 1. API路由修复 (`app/api/grids/[id]/route.ts`)

**修改前：**
```typescript
data: {
  ...(nodes && { nodes: JSON.stringify(nodes) }),  // ❌ 再次序列化
  ...(edges && { edges: JSON.stringify(edges) }),  // ❌ 再次序列化
}
```

**修改后：**
```typescript
// nodes和edges已经是JSON字符串，直接保存
if (nodes !== undefined) {
  updateData.nodes = nodes  // ✅ 直接使用
}
if (edges !== undefined) {
  updateData.edges = edges  // ✅ 直接使用
}
```

### 2. 添加调试信息

**编辑页面 (`app/grid/[id]/edit/page.tsx`)**

保存时：
```javascript
console.log('Saving nodes:', cleanNodes.length)
console.log('Saving edges:', cleanEdges.length)
console.log('Saved successfully:', savedData)
```

读取时：
```javascript
console.log('Fetched grid data:', {
  id: data.id,
  name: data.name,
  nodesType: typeof data.nodes,
  edgesType: typeof data.edges,
})
console.log('Parsed nodes:', parsedNodes.length)
console.log('Parsed edges:', parsedEdges.length)
```

## 测试步骤

1. **打开浏览器开发者工具**（F12）
2. **切换到Console标签**
3. **编辑电网并保存**
4. **观察Console输出**：

```
✅ 正确输出示例：
Saving nodes: 5
Saving edges: 4
Saved successfully: { id: "...", nodes: "[{...}]", ... }

✅ 重新加载后：
Fetched grid data: { nodesType: "string", edgesType: "string" }
Parsed nodes: 5
Parsed edges: 4
```

```
❌ 错误输出示例：
Fetched grid data: { nodesType: "string", edgesType: "string" }
Failed to parse nodes: SyntaxError: ...
Parsed nodes: 0  // ← 说明解析失败
```

## 如何更新

### 方式1：重新下载（推荐）
直接下载新的zip文件，解压替换

### 方式2：手动修改文件
只需修改 `app/api/grids/[id]/route.ts` 的PUT方法：

```typescript
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ENGINEER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { nodes, edges, name, description } = await request.json()

    const updateData: any = {}
    
    // nodes和edges已经是JSON字符串，直接保存
    if (nodes !== undefined) {
      updateData.nodes = nodes
    }
    if (edges !== undefined) {
      updateData.edges = edges
    }
    if (name) {
      updateData.name = name
    }
    if (description !== undefined) {
      updateData.description = description
    }

    const grid = await prisma.powerGrid.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json(grid)
  } catch (error) {
    console.error('Update grid error:', error)
    return NextResponse.json({ error: 'Failed to update grid' }, { status: 500 })
  }
}
```

### 方式3：如果数据已损坏

如果之前保存的数据已经双重序列化，需要重置数据库：

```bash
# 重置数据库
npx prisma db push --force-reset

# 重新填充示例数据
npx tsx prisma/seed.ts

# 重启服务
npm run dev
```

## 验证修复

1. 创建一个新电网
2. 添加几个元件和连线
3. 点击保存
4. 刷新页面或重新进入
5. 确认元件和连线都还在 ✅

## 技术细节

### 数据流

**保存：**
```
React State (对象数组)
  ↓ cleanNodes/cleanEdges 清理
  ↓ JSON.stringify() 第一次序列化
  ↓ fetch发送
  ↓ API接收 (已是字符串)
  ↓ 直接保存到数据库 ✅
```

**读取：**
```
数据库 (JSON字符串)
  ↓ API返回
  ↓ fetch接收
  ↓ JSON.parse() 解析
  ↓ React State (对象数组) ✅
```

现在保存功能完全正常了！

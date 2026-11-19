/** 极简并查集：用于把"等电位"的端口合并成电气节点 */
export class UnionFind {
  private parent = new Map<string, string>()

  find(id: string): string {
    if (!this.parent.has(id)) {
      this.parent.set(id, id)
      return id
    }
    let root = id
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root) as string
    }
    // 路径压缩
    let current = id
    while (this.parent.get(current) !== root) {
      const next = this.parent.get(current) as string
      this.parent.set(current, root)
      current = next
    }
    return root
  }

  union(a: string, b: string) {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) this.parent.set(rootB, rootA)
  }

  connected(a: string, b: string) {
    return this.find(a) === this.find(b)
  }
}
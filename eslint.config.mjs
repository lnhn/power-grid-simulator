import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  {
    // 当前仍使用 React 18 + 事件回调/Effect 拉取数据的既有模式。
    // 下面四条是 ESLint 9 / React Compiler 引入的实验性规则，会在这些合法模式上误报；
    // 保留 rules-of-hooks 与 exhaustive-deps 作为核心 Hooks 门禁。
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
    },
  },
])

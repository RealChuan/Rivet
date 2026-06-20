1. 配置
   - 配置在 CSS 中用 `@theme`，无 `tailwind.config.js`；入口用 `@import "tailwindcss"`
   - Vite 集成用 `@tailwindcss/vite`，无需 postcss/autoprefixer

2. 主题
   - 自定义令牌在 `@theme` 中定义；暗色模式覆盖必须用 `@theme`（非 `@theme inline`）
   - 暗色模式令牌必须同时定义 light/dark 值，原生颜色类必须有 `dark:` 变体

3. 类名规范
   - 复杂条件类名用 `tailwind-merge` + `clsx`；单文件 arbitrary values 不超过 3 处
   - 优先用逻辑属性（`inline`/`block`）替代物理方向（`left`/`right`）

4. 可访问性
   - 交互元素必须有 `focus-visible:` 或 `focus:` 样式
   - 图标按钮必须提供 `aria-label`；颜色对比度满足 WCAG AA

1. 配置方式
   - Tailwind 4.x 使用 Oxide/Lightning CSS 引擎，配置在 CSS 中通过 `@theme` 完成，无 `tailwind.config.js`
   - 全局样式入口使用 `@import "tailwindcss"`，禁止遗留 `@tailwind` 指令

2. 内容检测
   - Tailwind 4 自动检测内容（无需 `content` 配置），如需额外源使用 `@source`，排除使用 `@source not`

3. 主题令牌
   - 自定义主题令牌在 `@theme` 中定义，自动生成 utility 和 CSS 变量：`--color-brand` → `bg-brand` / `text-brand`
   - 需要暗色模式覆盖的令牌必须使用 `@theme`（非 `@theme inline`），`@theme inline` 会将值编译到 utility 中导致无法被级联覆盖
   - 使用 `@theme` 令牌 + `.dark` 覆盖实现暗色模式时，令牌必须同时定义 light/dark 值；使用 Tailwind 原生颜色类时必须有 `dark:` 变体

4. 类名规范
   - 优先使用语义化类名，单文件内 arbitrary values（`w-[123px]`）不得超过 3 处
   - 复杂条件类名必须使用 `tailwind-merge` + `clsx`，禁止裸字符串拼接

5. 容器查询与逻辑属性
   - 容器查询优先使用原生 `@container` + `@sm`/`@md`/`@lg`（Tailwind 4 内置，无需插件）
   - 逻辑属性优先使用 CSS 逻辑方向（`inline`/`block`），替代物理方向（`left`/`right`）

6. 可访问性
   - 交互元素必须有可见的 focus 样式（`focus-visible:` 或 `focus:`）
   - 图标按钮和纯视觉元素必须提供 `aria-label`
   - 颜色对比度必须满足 WCAG AA 标准（4.5:1 正文，3:1 大文本）

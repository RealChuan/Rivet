1. 文本规范
   - UI 文本禁止硬编码，必须用 selector API `t($ => $.feature.subFeature.element)`
   - Key 命名 `feature.subFeature.element` 层级；需在 init() 启用 `enableSelector: true`

2. 格式化
   - 日期/数字/货币用 `Intl.DateTimeFormat`/`Intl.NumberFormat` 配合 `i18next.services.formatter.add()`
   - 禁止 `interpolation.format` 回调（i18next 26 已移除）

3. 语言同步
   - 新增/修改/删除 i18n key 后同步更新所有语言文件和 `t()` 调用处

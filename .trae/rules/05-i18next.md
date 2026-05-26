1. 文本规范
   - UI 文本禁止硬编码，必须使用 `t('feature.element')` 或 `<Trans>`
   - Key 命名规范：`feature.subFeature.element` 层级，禁止扁平命名如 `t('submit')`

2. 格式化
   - 日期/数字/货币必须使用 `Intl.DateTimeFormat` / `Intl.NumberFormat`，配合 i18next 的 `interpolation.format` 回调，禁止裸 `toLocaleString`
   - i18next 26.x 的 `getFixedT` 支持第四参数 `fixedOpts` 携带 `scopeNs`，多 namespace 场景优先使用此特性

3. 语言同步
   - 新增页面后同步更新所有语言文件，禁止只改一种语言
   - 修改或删除已有 i18n key 后同步修改所有 `t()` 调用处

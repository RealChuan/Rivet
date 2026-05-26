1. 命名规范
   - 文件夹：kebab-case（如 `user-profile`）
   - React 组件：PascalCase.tsx（如 `UserProfile.tsx`）
   - 工具函数/服务/处理器/常量：kebab-case.ts（如 `format-date.ts`、`session-manager.ts`）
   - Store：kebab-case.ts（如 `ui.ts`、`session.ts`）

2. 目录约束
   - 新增模块必须遵循现有目录结构，禁止为了个人偏好新建平行目录

3. 重命名
   - 允许重命名文件，但重命名后同步修改所有 import 路径

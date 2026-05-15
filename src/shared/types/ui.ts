import type { Theme } from '@shared/constants/theme.js'
import type { SupportedLanguageLiteral } from '@shared/constants/i18n.js'

/**
 * UI 设置接口
 * 存储用户界面相关的配置偏好
 */
export interface UiSettings {
  /**
   * 主题模式
   * - light: 亮色主题
   * - dark: 暗色主题
   * - system: 跟随系统主题
   */
  theme: Theme

  /**
   * 语言设置
   * - 'zh-CN': 简体中文
   * - 'en-US': 英文
   * - '': 跟随系统语言
   */
  language: SupportedLanguageLiteral | ''
}

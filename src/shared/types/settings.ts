import type { SortOrder, SupportedLanguageLiteral, Theme } from '@shared/constants/index.js'

/**
 * UI 设置接口
 * 存储用户界面相关的配置偏好
 */
export interface UiSettings {
  /**
   * 外观主题
   * - light: 亮色主题
   * - dark: 暗色主题
   * - system: 跟随系统主题
   */
  appearance: Theme

  /**
   * 语言设置
   * - 'zh-CN': 简体中文
   * - 'en-US': 英文
   * - '': 跟随系统语言
   */
  locale: SupportedLanguageLiteral | ''

  /**
   * 连接列表排序状态
   * - 'none': 不排序（按拖拽顺序）
   * - 'asc': 按名称升序
   * - 'desc': 按名称降序
   */
  connectionSortOrder: SortOrder
}

/**
 * 传输设置接口
 * 存储传输任务的并发配置
 */
export interface TransferSettings {
  maxUploadConcurrency: number
  maxDownloadConcurrency: number
}

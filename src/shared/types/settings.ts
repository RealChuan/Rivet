import type { CloseBehavior, SupportedLanguageLiteral, Theme } from '@shared/constants/index.js'

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

  /** 是否显示以 `.` 开头的隐藏条目 */
  showHiddenFiles: boolean

  /**
   * 关闭主窗口时的行为
   * - tray: 隐藏到系统托盘，连接与传输继续
   * - quit: 退出应用
   */
  closeBehavior: CloseBehavior

  /** 终端字号（px） */
  terminalFontSize: number
}

/**
 * 传输设置接口
 * 存储传输任务的并发配置
 */
export interface TransferSettings {
  maxUploadConcurrency: number
  maxDownloadConcurrency: number
}

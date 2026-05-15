/**
 * IPC 通道名称常量定义
 *
 * 通道命名规范：
 * - 使用冒号分隔命名空间和操作
 * - 命名空间包括：common（通用）、protocol（协议操作）、events（事件通知）
 */
export const IPC_CHANNELS = {
  /**
   * 通用 IPC 通道
   */
  COMMON: {
    /** 获取应用版本号 */
    GET_APP_VERSION: 'common:get-app-version',
    /** 从 electron-store 获取值 */
    STORE_GET: 'common:store-get',
    /** 向 electron-store 设置值 */
    STORE_SET: 'common:store-set',
    /** 从 electron-store 删除值 */
    STORE_DELETE: 'common:store-delete',
    /** 获取保存的连接配置列表 */
    GET_SAVED_CONNECTIONS: 'common:get-saved-connections',
    /** 删除连接配置 */
    DELETE_CONNECTION: 'common:delete-connection',
    /** 从 keytar 获取凭据（密码） */
    GET_CREDENTIAL: 'common:get-credential',
    /** 获取系统临时目录路径 */
    GET_TEMP_DIR: 'common:get-temp-dir',
    /** 获取系统下载目录路径 */
    GET_DOWNLOAD_DIR: 'common:get-download-dir',
    /** 显示文件选择对话框 */
    SHOW_OPEN_DIALOG: 'common:show-open-dialog',
    /** 显示文件保存对话框 */
    SHOW_SAVE_DIALOG: 'common:show-save-dialog',
    /** 判断应用是否为打包状态 */
    GET_IS_PACKAGED: 'common:get-is-packaged',
    /** 保存已知主机密钥 */
    SAVE_KNOWN_HOST: 'common:save-known-host',
    /** 删除已知主机密钥 */
    DELETE_KNOWN_HOST: 'common:delete-known-host',
  },
  /**
   * 协议操作 IPC 通道
   */
  PROTOCOL: {
    /** 建立连接 */
    CONNECT: 'protocol:connect',
    /** 断开连接 */
    DISCONNECT: 'protocol:disconnect',
    /** 列出目录内容 */
    LIST: 'protocol:list',
    /** 创建目录 */
    MKDIR: 'protocol:mkdir',
    /** 重命名文件/目录 */
    RENAME: 'protocol:rename',
    /** 删除文件/目录 */
    DELETE: 'protocol:delete',
    /** 复制文件/目录 */
    COPY: 'protocol:copy',
    /** 移动文件/目录 */
    MOVE: 'protocol:move',
  },
  /**
   * 事件通知 IPC 通道（主进程主动推送）
   */
  EVENTS: {
    /** 会话断开通知 */
    SESSION_DISCONNECTED: 'session-disconnected',
  },
} as const

/**
 * IPC 通道类型定义
 */
export type IpcChannels = typeof IPC_CHANNELS

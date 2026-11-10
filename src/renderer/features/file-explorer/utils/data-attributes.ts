/**
 * 文件列表的 DOM 契约。
 *
 * 生产者（FileListItem / FileGridItem / FileView / FileListHeader）写入属性，
 * 消费者（use-file-drag-select / use-file-dragging）用选择器读取。
 * `data-drag-source` 决定「拖动移动」与「框选」的互斥分支：只改一侧会让两种行为
 * 同时触发，裸字符串对此没有任何编译期保护。
 */
export const FILE_DATA_ATTR = {
  /** 可拖拽源；命中时 mousedown 交给拖动，不进入框选。 */
  DRAG_SOURCE: 'data-drag-source',
  /** 列表表头；在表头上按下不进入框选。 */
  LIST_HEADER: 'data-file-list-header',
  /** 条目根节点。 */
  ITEM: 'data-file-item',
  /** 条目的远端绝对路径。 */
  PATH: 'data-file-path',
} as const

/** 供 `closest` / `querySelectorAll` 使用的选择器文本。 */
export const FILE_DATA_SELECTOR = {
  DRAG_SOURCE: `[${FILE_DATA_ATTR.DRAG_SOURCE}]`,
  LIST_HEADER: `[${FILE_DATA_ATTR.LIST_HEADER}]`,
  ITEM: `[${FILE_DATA_ATTR.ITEM}]`,
  PATH: `[${FILE_DATA_ATTR.PATH}]`,
} as const

/** `dataset` 侧键名（camelCase），与上面的 kebab-case 属性一一对应。 */
export const FILE_DATASET_KEY = {
  PATH: 'filePath',
} as const

/** 空值属性：`{...FILE_DRAG_SOURCE_ATTR}` 等价于 `data-drag-source=""`。 */
export const FILE_DRAG_SOURCE_ATTR = { [FILE_DATA_ATTR.DRAG_SOURCE]: '' } as const

/** 表头标记属性，同样以空值渲染。 */
export const FILE_LIST_HEADER_ATTR = { [FILE_DATA_ATTR.LIST_HEADER]: '' } as const

/** 条目根节点的 data 属性；用 spread 注入以保留 JSX 的可读性。 */
export function fileItemDataAttrs(file: {
  name: string
  absolutePath: string
}): Record<string, string> {
  return {
    [FILE_DATA_ATTR.ITEM]: file.name,
    [FILE_DATA_ATTR.PATH]: file.absolutePath,
  }
}

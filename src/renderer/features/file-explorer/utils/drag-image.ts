/**
 * 原生拖拽图的定制：浏览器默认拿「拖拽源元素」的快照，多选时只会显示光标抓住的那一项，
 * 既不告诉用户拖了几项，也随抓取位置（整行 / 名称格 / 网格图标）长成不同样子。
 * 这里统一换成一张固定外观的小卡片：名称 + 条目数。
 */

/** `setDragImage` 只需要这一个能力，收窄后测试可以直接传桩件。 */
export type DragImageTransfer = Pick<DataTransfer, 'setDragImage'>

export function showFileDragImage(
  transfer: DragImageTransfer,
  name: string,
  note: string | null,
): void {
  // 卡片外面套一圈透明留白，热点取左上角 (0,0)：光标落在留白里，不会压住名称开头。
  // 用 padding 而不是负偏移，是因为负偏移能否生效取决于平台，留白是确定的。
  const frame = document.createElement('div')
  frame.className = 'fixed -top-[1000px] -left-[1000px] p-3'

  // 深色不透明底 + 实心文字：拖拽时要一眼读出"在拖什么"，半透明会让对比度随下层内容浮动，
  // 反复对焦比"重一点"更累。单一层次感交给投影，不再叠边框。
  const card = document.createElement('div')
  card.className = [
    'flex max-w-60 items-center gap-2',
    'rounded-md bg-glass-bg px-3 py-1.5',
    'text-text shadow-dropdown',
  ].join(' ')

  const label = document.createElement('span')
  label.className = 'min-w-0 truncate text-base font-medium'
  label.textContent = name
  card.append(label)

  // 条目数贴着名称排在行尾，比名称小一号但仍是可读的常规文字尺寸。
  if (note !== null) {
    const count = document.createElement('span')
    count.className = 'shrink-0 text-sm text-text-muted'
    count.textContent = note
    card.append(count)
  }

  frame.append(card)
  document.body.append(frame)
  transfer.setDragImage(frame, 0, 0)
  // 浏览器在 setDragImage 时已取走快照，下一轮事件循环再移除，避免个别平台拿不到尺寸。
  setTimeout(() => frame.remove(), 0)
}

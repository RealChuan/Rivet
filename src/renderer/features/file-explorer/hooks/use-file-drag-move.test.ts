import { describe, expect, it } from 'vitest'
import { dropStateOf, isForbiddenDropTarget } from './use-file-drag-move.js'

const dragged = [{ absolutePath: '/photos' }, { absolutePath: '/notes.txt' }]

describe('isForbiddenDropTarget', () => {
  it('挡掉投放到被拖动的文件夹本身', () => {
    expect(isForbiddenDropTarget(dragged, '/photos')).toBe(true)
  })

  it('挡掉投放到被拖动文件夹的子目录', () => {
    expect(isForbiddenDropTarget(dragged, '/photos/2024')).toBe(true)
  })

  it('不误伤同名前缀的兄弟目录', () => {
    expect(isForbiddenDropTarget(dragged, '/photos-backup')).toBe(false)
  })

  it('拖动文件时它的父目录仍可投放', () => {
    expect(isForbiddenDropTarget(dragged, '/')).toBe(false)
  })

  it('空选择不会挡住任何目标', () => {
    expect(isForbiddenDropTarget([], '/photos')).toBe(false)
  })
})

describe('dropStateOf', () => {
  const target = { path: '/photos', allowed: false }

  it('目标为空时谁都不是投放目标', () => {
    expect(dropStateOf(null, '/photos')).toBe('none')
  })

  it('只有被指到的那一行拿到状态', () => {
    expect(dropStateOf(target, '/notes.txt')).toBe('none')
    expect(dropStateOf(target, '/photos')).toBe('forbidden')
  })

  it('允许投放时返回 allowed', () => {
    expect(dropStateOf({ path: '/photos', allowed: true }, '/photos')).toBe('allowed')
  })
})

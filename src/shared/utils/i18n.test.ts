import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGE,
  SUPPORTED_LANGUAGES,
} from '@shared/constants/i18n.js'
import { detectLanguageWithFallback, matchSupportedLanguage } from './i18n.js'

describe('i18n constants', () => {
  it('should export correct language constants', () => {
    expect(SUPPORTED_LANGUAGE.ZH_CN).toBe('zh-CN')
    expect(SUPPORTED_LANGUAGE.EN_US).toBe('en-US')
  })

  it('should have correct supported languages list', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['zh-CN', 'en-US'])
  })

  it('should have correct default language', () => {
    expect(DEFAULT_LANGUAGE).toBe('en-US')
  })
})

describe('matchSupportedLanguage', () => {
  it('should return zh-CN for exact zh-CN locale', () => {
    expect(matchSupportedLanguage('zh-CN')).toBe('zh-CN')
  })

  it('should return en-US for exact en-US locale', () => {
    expect(matchSupportedLanguage('en-US')).toBe('en-US')
  })

  it('should return zh-CN for zh prefix', () => {
    expect(matchSupportedLanguage('zh')).toBe('zh-CN')
    expect(matchSupportedLanguage('zh-Hans')).toBe('zh-CN')
    expect(matchSupportedLanguage('zh-Hant')).toBe('zh-CN')
  })

  it('should return null for unsupported language', () => {
    expect(matchSupportedLanguage('fr-FR')).toBeNull()
    expect(matchSupportedLanguage('ja-JP')).toBeNull()
    expect(matchSupportedLanguage('de-DE')).toBeNull()
  })

  it('should handle non-string inputs', () => {
    expect(matchSupportedLanguage(123 as unknown as string)).toBeNull()
    expect(matchSupportedLanguage(null as unknown as string)).toBeNull()
  })
})

describe('detectLanguageWithFallback', () => {
  it('should return matched language when system locale is supported', () => {
    expect(detectLanguageWithFallback(() => 'zh-CN')).toBe('zh-CN')
    expect(detectLanguageWithFallback(() => 'en-US')).toBe('en-US')
  })

  it('should return zh-CN for Chinese variants', () => {
    expect(detectLanguageWithFallback(() => 'zh')).toBe('zh-CN')
    expect(detectLanguageWithFallback(() => 'zh-Hans-CN')).toBe('zh-CN')
  })

  it('should return default language for unsupported locale', () => {
    expect(detectLanguageWithFallback(() => 'fr-FR')).toBe('en-US')
    expect(detectLanguageWithFallback(() => 'unknown')).toBe('en-US')
  })

  it('should return default language when getLocale throws', () => {
    const throwingFn = () => {
      throw new Error('Failed to get locale')
    }
    expect(detectLanguageWithFallback(throwingFn)).toBe('en-US')
  })
})

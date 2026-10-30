import { describe, expect, it } from 'vitest'
import { buildBasicAuthorization, buildDigestAuthorization, parseDigestChallenge } from './auth.js'

describe('buildBasicAuthorization', () => {
  it('按 RFC 7617 生成 Basic 头', () => {
    expect(buildBasicAuthorization('user', 'pass')).toBe('Basic dXNlcjpwYXNz')
  })
})

describe('parseDigestChallenge', () => {
  it('解析引号、qop 与 opaque', () => {
    expect(
      parseDigestChallenge(
        'Digest realm="testrealm@host.com", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", qop="auth,auth-int", opaque="5ccc069c403ebaf9f0171e9517f40e41", algorithm=MD5',
      ),
    ).toEqual({
      realm: 'testrealm@host.com',
      nonce: 'dcd98b7102dd2f0e8b11d0f600bfb0c093',
      qop: 'auth,auth-int',
      opaque: '5ccc069c403ebaf9f0171e9517f40e41',
      algorithm: 'MD5',
    })
  })

  it('非 Digest challenge 返回 null', () => {
    expect(parseDigestChallenge('Basic realm="test"')).toBeNull()
  })
})

describe('buildDigestAuthorization', () => {
  it('与 RFC 2617 示例一致', () => {
    const header = buildDigestAuthorization(
      {
        realm: 'testrealm@host.com',
        nonce: 'dcd98b7102dd2f0e8b11d0f600bfb0c093',
        qop: 'auth,auth-int',
        opaque: '5ccc069c403ebaf9f0171e9517f40e41',
        algorithm: 'MD5',
      },
      {
        method: 'GET',
        uri: '/dir/index.html',
        username: 'Mufasa',
        password: 'Circle Of Life',
        nc: '00000001',
        cnonce: '0a4f113b',
      },
    )

    expect(header).toContain('response="6629fae49393a05397450978507c4ef1"')
    expect(header).toContain('qop=auth')
    expect(header).toContain('nc=00000001')
    expect(header).toContain('cnonce="0a4f113b"')
    expect(header).toContain('opaque="5ccc069c403ebaf9f0171e9517f40e41"')
  })

  it('不支持的算法抛 AUTH_ERROR', () => {
    try {
      buildDigestAuthorization(
        { realm: 'r', nonce: 'n', algorithm: 'SHA-256' },
        {
          method: 'GET',
          uri: '/',
          username: 'u',
          password: 'p',
          nc: '00000001',
          cnonce: 'abc',
        },
      )
      expect.unreachable()
    } catch (error) {
      expect(error).toMatchObject({ code: 'AUTH_ERROR' })
    }
  })
})

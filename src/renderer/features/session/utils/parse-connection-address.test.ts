import { describe, expect, it } from 'vitest'
import { parseConnectionAddress } from './parse-connection-address.js'

describe('parseConnectionAddress', () => {
  it('解析 SFTP 地址', () => {
    expect(parseConnectionAddress('sftp://alice@example.com:2222/home/alice')).toEqual({
      protocol: 'sftp',
      host: 'example.com',
      port: '2222',
      username: 'alice',
    })
  })

  it('缺端口时用协议默认端口', () => {
    expect(parseConnectionAddress('sftp://alice@example.com')).toEqual({
      protocol: 'sftp',
      host: 'example.com',
      port: '22',
      username: 'alice',
    })
  })

  it('忽略 userinfo 里的密码', () => {
    expect(parseConnectionAddress('sftp://alice:secret@example.com')).toEqual({
      protocol: 'sftp',
      host: 'example.com',
      port: '22',
      username: 'alice',
    })
  })

  it('解析 IPv6 主机', () => {
    expect(parseConnectionAddress('sftp://alice@[::1]:2200')).toEqual({
      protocol: 'sftp',
      host: '::1',
      port: '2200',
      username: 'alice',
    })
  })

  it('SMB 地址的第一个路径段是共享名', () => {
    expect(parseConnectionAddress('smb://corp/team/share/sub')).toEqual({
      protocol: 'smb',
      host: 'corp',
      port: '445',
      username: '',
      share: 'team',
    })
  })

  it('webdavs 走 https 并把路径当作根', () => {
    expect(parseConnectionAddress('webdavs://bob@dav.example.com/files/work')).toEqual({
      protocol: 'webdav',
      host: 'dav.example.com',
      port: '443',
      username: 'bob',
      scheme: 'https',
      basePath: '/files/work',
    })
  })

  it('webdav 走 http', () => {
    expect(parseConnectionAddress('webdav://dav.example.com:8080/dav')).toEqual({
      protocol: 'webdav',
      host: 'dav.example.com',
      port: '8080',
      username: '',
      scheme: 'http',
      basePath: '/dav',
    })
  })

  it('路径做 URL 解码', () => {
    expect(parseConnectionAddress('webdavs://dav.example.com/a%20b')).toMatchObject({
      basePath: '/a b',
    })
  })

  it('端口非法时回落默认端口', () => {
    expect(parseConnectionAddress('sftp://alice@example.com:70000')).toMatchObject({ port: '22' })
  })

  it('认不出协议时返回 null', () => {
    expect(parseConnectionAddress('ftp://example.com')).toBeNull()
    expect(parseConnectionAddress('example.com')).toBeNull()
    expect(parseConnectionAddress('')).toBeNull()
  })

  it('缺主机时返回 null', () => {
    expect(parseConnectionAddress('sftp://alice@')).toBeNull()
    expect(parseConnectionAddress('sftp://')).toBeNull()
  })
})

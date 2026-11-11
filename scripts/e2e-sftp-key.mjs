/** 为集成测试的私钥用例生成一对一次性密钥；已存在就跳过。 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'

const dir = 'e2e/servers/sftp-keys'
const privateKey = `${dir}/id_ed25519`
const publicKey = `${privateKey}.pub`

if (!existsSync(privateKey) || !existsSync(publicKey)) {
  rmSync(privateKey, { force: true })
  rmSync(publicKey, { force: true })
  mkdirSync(dir, { recursive: true })
  execFileSync(
    'ssh-keygen',
    ['-t', 'ed25519', '-N', '', '-C', 'rivet-integration-test-only', '-f', privateKey],
    { stdio: 'ignore' },
  )
}

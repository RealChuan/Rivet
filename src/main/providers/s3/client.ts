import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import https from 'node:https'
import type { Credentials } from '@shared/domain/credentials.js'
import type { ConnectionConfig } from '@shared/types/connection.js'
import { ERROR_CODE, SCHEME } from '@shared/constants/index.js'
import { ProviderError } from '../errors.js'
import { toS3ProviderError } from './error-map.js'

export interface S3ObjectSummary {
  readonly key: string
  readonly size: number
  readonly lastModified: number
}

export interface S3ListPage {
  readonly objects: readonly S3ObjectSummary[]
  readonly prefixes: readonly string[]
  readonly nextToken: string | undefined
}

export interface S3ReadHandle {
  readonly stream: ReadableStream<Uint8Array>
  close(): Promise<void>
}

export interface S3MultipartPart {
  readonly partNumber: number
  readonly etag: string
}

/**
 * S3 的最小端口：provider 只依赖这些方法，单测注入 fake 即可覆盖分页与分片状态机。
 * 方法与 S3 的 HTTP 动作一一对应，不在此处做业务判断。
 */
export interface S3ClientPort {
  listPage(input: {
    prefix: string
    delimiter: string
    maxKeys: number
    token?: string
    signal?: AbortSignal
  }): Promise<S3ListPage>
  headObject(key: string, signal?: AbortSignal): Promise<S3ObjectSummary | null>
  getObject(key: string, opts: { start?: number; signal?: AbortSignal }): Promise<S3ReadHandle>
  putObject(key: string, body: Uint8Array, contentType: string, signal?: AbortSignal): Promise<void>
  presignGet(key: string, expiresInSeconds: number): Promise<string>
  deleteObject(key: string, signal?: AbortSignal): Promise<void>
  deleteObjects(keys: readonly string[], signal?: AbortSignal): Promise<void>
  copyObject(from: string, to: string, signal?: AbortSignal): Promise<void>
  createMultipartUpload(key: string, contentType: string, signal?: AbortSignal): Promise<string>
  uploadPart(input: {
    key: string
    uploadId: string
    partNumber: number
    body: Uint8Array
    signal?: AbortSignal
  }): Promise<string>
  completeMultipartUpload(input: {
    key: string
    uploadId: string
    parts: readonly S3MultipartPart[]
    signal?: AbortSignal
  }): Promise<void>
  abortMultipartUpload(input: { key: string; uploadId: string }): Promise<void>
  close(): Promise<void>
}

const DELETE_BATCH_SIZE = 1000

function endpointOf(config: ConnectionConfig): string {
  const scheme = config.scheme ?? SCHEME.HTTPS
  return `${scheme}://${config.host}:${config.port}`
}

/**
 * CopySource 必须是 URL 编码的 `/bucket/key`；逐段编码以保留 key 里的斜杠。
 * SDK 不会替我们编码，空格、井号这类字符不处理会直接 400。
 */
export function encodeCopySource(bucket: string, key: string): string {
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `/${encodeURIComponent(bucket)}/${encodedKey}`
}

function abortOptions(signal: AbortSignal | undefined): { abortSignal?: AbortSignal } {
  return signal === undefined ? {} : { abortSignal: signal }
}

/** 只依赖端点与凭证的 SDK 客户端：连接与「列出桶」共用，避免两份超时/证书配置。 */
function createSdkClient(config: ConnectionConfig, credentials: Credentials): S3Client {
  if (credentials.kind !== 'accessKey') {
    throw new ProviderError(ERROR_CODE.INVALID_CONFIG, 'S3 requires accessKey credentials')
  }

  return new S3Client({
    region: config.region ?? 'us-east-1',
    endpoint: endpointOf(config),
    forcePathStyle: config.pathStyle ?? true,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
    // 自签证书的兼容端点需要关掉校验；与 WebDAV 的 dispatcher 保持一致。
    requestHandler: new NodeHttpHandler({
      httpsAgent: new https.Agent({ rejectUnauthorized: config.rejectUnauthorized ?? true }),
    }),
    // 兼容实现对新版默认 CRC32 校验头支持不一，只在协议要求时计算。
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
}

/** 列出账号可见的桶；连接对话框用它代替手打桶名。 */
export async function listBuckets(
  config: ConnectionConfig,
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<string[]> {
  const client = createSdkClient(config, credentials)
  try {
    const output = await client.send(new ListBucketsCommand({}), abortOptions(signal))
    return (output.Buckets ?? []).flatMap((entry) =>
      typeof entry.Name === 'string' && entry.Name.length > 0 ? [entry.Name] : [],
    )
  } catch (error) {
    throw toS3ProviderError(error, 'listBuckets')
  } finally {
    client.destroy()
  }
}

/** 真实实现：把 aws-sdk 的命令翻译成端口方法，所有错误统一折叠成 ProviderError。 */
export function createS3Client(config: ConnectionConfig, credentials: Credentials): S3ClientPort {
  const bucket = config.bucket ?? ''
  if (bucket === '') {
    throw new ProviderError(ERROR_CODE.INVALID_CONFIG, 'S3 bucket is required')
  }

  const client = createSdkClient(config, credentials)

  function fail(error: unknown, action: string): ProviderError {
    return toS3ProviderError(error, action)
  }

  return {
    async listPage(input) {
      try {
        const output = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: input.prefix,
            Delimiter: input.delimiter,
            MaxKeys: input.maxKeys,
            ...(input.token === undefined ? {} : { ContinuationToken: input.token }),
          }),
          abortOptions(input.signal),
        )

        return {
          objects: (output.Contents ?? []).flatMap((item) =>
            item.Key === undefined
              ? []
              : [
                  {
                    key: item.Key,
                    size: item.Size ?? 0,
                    lastModified: item.LastModified?.getTime() ?? 0,
                  },
                ],
          ),
          prefixes: (output.CommonPrefixes ?? []).flatMap((item) =>
            item.Prefix === undefined ? [] : [item.Prefix],
          ),
          nextToken: output.IsTruncated === true ? output.NextContinuationToken : undefined,
        }
      } catch (error) {
        throw fail(error, 'list')
      }
    },

    async headObject(key, signal) {
      try {
        const output = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key }),
          abortOptions(signal),
        )
        return {
          key,
          size: output.ContentLength ?? 0,
          lastModified: output.LastModified?.getTime() ?? 0,
        }
      } catch (error) {
        const mapped = fail(error, 'stat')
        if (mapped.code === ERROR_CODE.NOT_FOUND) return null
        throw mapped
      }
    },

    async getObject(key, opts) {
      try {
        const output = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
            ...(opts.start === undefined || opts.start === 0
              ? {}
              : { Range: `bytes=${opts.start}-` }),
          }),
          abortOptions(opts.signal),
        )

        const body = output.Body
        if (body === undefined) {
          throw new ProviderError(ERROR_CODE.NOT_FOUND, `S3 object has no body: ${key}`)
        }

        // SDK 的 SdkStream 只给出默认泛型的 ReadableStream，这里明确成字节流。
        const stream = body.transformToWebStream() as ReadableStream<Uint8Array>
        return {
          stream,
          close: async () => {
            if (stream.locked) return
            await stream.cancel().catch(() => {})
          },
        }
      } catch (error) {
        throw fail(error, 'download')
      }
    },

    async putObject(key, body, contentType, signal) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentLength: body.byteLength,
            ContentType: contentType,
          }),
          abortOptions(signal),
        )
      } catch (error) {
        throw fail(error, 'upload')
      }
    },

    /** 本地签名，不发请求。 */
    async presignGet(key, expiresInSeconds) {
      try {
        return await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
          expiresIn: expiresInSeconds,
        })
      } catch (error) {
        throw fail(error, 'presign')
      }
    },

    async deleteObject(key, signal) {
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: key }),
          abortOptions(signal),
        )
      } catch (error) {
        throw fail(error, 'delete')
      }
    },

    async deleteObjects(keys, signal) {
      for (let start = 0; start < keys.length; start += DELETE_BATCH_SIZE) {
        const batch = keys.slice(start, start + DELETE_BATCH_SIZE)
        if (batch.length === 0) continue

        try {
          await client.send(
            new DeleteObjectsCommand({
              Bucket: bucket,
              Delete: { Objects: batch.map((key) => ({ Key: key })), Quiet: true },
            }),
            abortOptions(signal),
          )
        } catch (error) {
          throw fail(error, 'delete')
        }
      }
    },

    async copyObject(from, to, signal) {
      try {
        await client.send(
          new CopyObjectCommand({
            Bucket: bucket,
            Key: to,
            CopySource: encodeCopySource(bucket, from),
          }),
          abortOptions(signal),
        )
      } catch (error) {
        throw fail(error, 'copy')
      }
    },

    async createMultipartUpload(key, contentType, signal) {
      try {
        const output = await client.send(
          new CreateMultipartUploadCommand({
            Bucket: bucket,
            Key: key,
            ContentType: contentType,
          }),
          abortOptions(signal),
        )
        if (output.UploadId === undefined) {
          throw new ProviderError(ERROR_CODE.UPLOAD_ERROR, 'S3 did not return an upload id')
        }
        return output.UploadId
      } catch (error) {
        throw fail(error, 'upload')
      }
    },

    async uploadPart(input) {
      try {
        const output = await client.send(
          new UploadPartCommand({
            Bucket: bucket,
            Key: input.key,
            UploadId: input.uploadId,
            PartNumber: input.partNumber,
            Body: input.body,
            ContentLength: input.body.byteLength,
          }),
          abortOptions(input.signal),
        )
        if (output.ETag === undefined) {
          throw new ProviderError(ERROR_CODE.UPLOAD_ERROR, 'S3 did not return a part ETag')
        }
        return output.ETag
      } catch (error) {
        throw fail(error, 'upload')
      }
    },

    async completeMultipartUpload(input) {
      try {
        await client.send(
          new CompleteMultipartUploadCommand({
            Bucket: bucket,
            Key: input.key,
            UploadId: input.uploadId,
            MultipartUpload: {
              Parts: input.parts.map((part) => ({
                ETag: part.etag,
                PartNumber: part.partNumber,
              })),
            },
          }),
          abortOptions(input.signal),
        )
      } catch (error) {
        throw fail(error, 'upload')
      }
    },

    async abortMultipartUpload(input) {
      try {
        await client.send(
          new AbortMultipartUploadCommand({
            Bucket: bucket,
            Key: input.key,
            UploadId: input.uploadId,
          }),
        )
      } catch {
        // 分片清理是尽力而为：失败时保留原错误，残留分片由用户自己在控制台处理。
      }
    },

    close: () => {
      client.destroy()
      return Promise.resolve()
    },
  }
}

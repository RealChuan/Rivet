import { z } from 'zod'

export interface KnownHostRecord {
  host: string
  port: number
  algorithm: string
  fingerprint: string
  createdAt: number
}

export interface HostKeyTrustRequest {
  host: string
  port: number
  algorithm: string
  fingerprint: string
}

export const hostKeyTrustRequestSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  algorithm: z.string().min(1),
  fingerprint: z.string().min(1),
})

export type HostKeyErrorDetail = HostKeyTrustRequest & {
  previousFingerprint?: string | undefined
}

export const hostKeyErrorDetailSchema = hostKeyTrustRequestSchema.extend({
  previousFingerprint: z.string().optional(),
})

export function parseHostKeyErrorDetail(detail: unknown): HostKeyErrorDetail | null {
  const parsed = hostKeyErrorDetailSchema.safeParse(detail)
  return parsed.success ? parsed.data : null
}

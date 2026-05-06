import { useQuery, useQueryClient } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithQueryClient } from '../test-utils/render-with-query-client.js'
import { createQueryClient } from './query-client.js'

function ClientProbe() {
  useQuery({ queryKey: ['probe'], queryFn: () => 'ok' })
  const client = useQueryClient()
  return (
    <div
      data-testid="probe"
      data-has-client="yes"
      data-stale-time={String(client.getDefaultOptions().queries?.staleTime)}
    />
  )
}

describe('QueryProvider', () => {
  it('renderWithQueryClient 注入同一个 client', () => {
    const client = createQueryClient()
    client.setDefaultOptions({ queries: { staleTime: 12_345 } })

    renderWithQueryClient(<ClientProbe />, { client })

    const probe = screen.getByTestId('probe')
    expect(probe.dataset.hasClient).toBe('yes')
    expect(probe.dataset.staleTime).toBe('12345')
  })
})

import type { ReactElement, ReactNode } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { queryClient } from './query-client.js'

interface QueryProviderProps {
  client?: QueryClient
  children: ReactNode
}

export function QueryProvider({
  client = queryClient,
  children,
}: QueryProviderProps): ReactElement {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

export default QueryProvider

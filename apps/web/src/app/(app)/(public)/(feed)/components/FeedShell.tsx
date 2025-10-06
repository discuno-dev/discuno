import { Suspense } from 'react'
import { LoadingSpinner } from '~/components/shared/LoadingSpinner'
import { DashboardContent } from './FeedContent'

interface DashboardShellProps {
  searchParams: { school?: string; major?: string; gradYear?: string }
}

export const DashboardShell = ({ searchParams }: DashboardShellProps) => {
  return (
    <main className="text-foreground min-h-screen">
      {/* Static layout that renders immediately */}
      <div className="relative">
        {/* Suspense boundary for dynamic content */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center">
              <LoadingSpinner />
            </div>
          }
        >
          <DashboardContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  )
}

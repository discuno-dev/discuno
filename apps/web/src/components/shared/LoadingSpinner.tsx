import { cva, type VariantProps } from 'class-variance-authority'
import React from 'react'
import { cn } from '~/lib/utils'

const loadingSpinnerVariants = cva('inline-flex items-center justify-center gap-2', {
  variants: {
    size: {
      sm: 'text-sm',
      default: 'text-base',
      lg: 'text-lg',
    },
    align: {
      left: 'justify-start',
      center: 'justify-center',
      right: 'justify-end',
    },
  },
  defaultVariants: {
    size: 'default',
    align: 'center',
  },
})

const spinnerVariants = cva('animate-spin rounded-full border-2 border-muted border-t-primary', {
  variants: {
    size: {
      sm: 'h-4 w-4',
      default: 'h-6 w-6',
      lg: 'h-8 w-8',
    },
  },
  defaultVariants: {
    size: 'default',
  },
})

export interface LoadingSpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof loadingSpinnerVariants> {
  text?: string
  showText?: boolean
  spinnerSize?: VariantProps<typeof spinnerVariants>['size']
}

export const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  (
    { className, size, align, text = 'Loading...', showText = true, spinnerSize, ...props },
    ref
  ) => {
    const effectiveSpinnerSize = spinnerSize ?? size

    return (
      <div
        ref={ref}
        className={cn(loadingSpinnerVariants({ size, align, className }))}
        role="status"
        aria-live="polite"
        aria-label={showText ? undefined : text}
        {...props}
      >
        <div className={cn(spinnerVariants({ size: effectiveSpinnerSize }))} aria-hidden="true" />
        {showText && <span className="text-muted-foreground">{text}</span>}
      </div>
    )
  }
)

LoadingSpinner.displayName = 'LoadingSpinner'

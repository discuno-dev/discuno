import { Send } from 'lucide-react'
import * as React from 'react'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

type ButtonVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'link'
  | 'destructive'
  | 'gray'
  | 'plain'
  | 'tinted'

const BUTTON_PREVIEWS: Array<{ variant: ButtonVariant; label: string }> = [
  { variant: 'default', label: 'Default' },
  { variant: 'secondary', label: 'Secondary' },
  { variant: 'outline', label: 'Outline' },
  { variant: 'ghost', label: 'Ghost' },
  { variant: 'link', label: 'Link' },
  { variant: 'destructive', label: 'Destructive' },
  { variant: 'gray', label: 'Gray' },
  { variant: 'plain', label: 'Plain' },
  { variant: 'tinted', label: 'Tinted' },
]

const Panel = ({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) => (
  <div
    className={cn(
      'bg-background/80 rounded-2xl border p-6 shadow-sm backdrop-blur transition-colors hover:shadow-md',
      'animate-in fade-in slide-in-from-bottom-2 duration-300',
      className
    )}
  >
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-muted-foreground text-sm font-semibold uppercase tracking-wide">
        {title}
      </h3>
    </div>
    {children}
  </div>
)

export default function UICanvasPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 p-6 md:p-10">
      {/* Header */}
      <header className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">UI Canvas</h1>
          <p className="text-muted-foreground text-sm">
            A preview of core components in different themes
          </p>
        </div>
      </header>

      {/* Button Previews */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Buttons</h2>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Light Theme */}
          <Panel title="Light">
            <div className="grid gap-3">
              {BUTTON_PREVIEWS.map(({ variant, label }) => (
                <div
                  key={`light-${variant}`}
                  className="hover:bg-muted/50 flex items-center justify-between rounded-lg p-3 transition-colors"
                >
                  <Button variant={variant} size="lg" className="min-w-36">
                    <Send className="size-4" />
                    Label
                  </Button>
                  <span className="text-muted-foreground text-sm">{label}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Dark Theme */}
          <div className="dark rounded-2xl">
            <Panel title="Dark">
              <div className="grid gap-3">
                {BUTTON_PREVIEWS.map(({ variant, label }) => (
                  <div
                    key={`dark-${variant}`}
                    className="hover:bg-muted/50 flex items-center justify-between rounded-lg p-3 transition-colors"
                  >
                    <Button variant={variant} size="lg" className="min-w-36">
                      <Send className="size-4" />
                      Label
                    </Button>
                    <span className="text-muted-foreground text-sm">{label}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-muted-foreground border-t pt-4 text-xs">
        Upcoming: Badge, Input, Select, Card, Alert, and more.
      </footer>
    </div>
  )
}

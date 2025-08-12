'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '~/components/ui/dialog'

type ModalProps = {
  children: React.ReactNode
  footer?: React.ReactNode
}

export const Modal = ({ children, footer }: ModalProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  useEffect(() => {
    setOpen(true) // Open the modal when the component mounts
  }, [])

  const onDismiss = () => {
    setOpen(false) // Close the modal
    router.back() // Navigate back
  }

  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onDismiss()}>
      <DialogContent className="aspect-[9/16] max-h-[85vh] w-full max-w-[85vw] overflow-hidden p-0 focus:outline-none sm:rounded-xl">
        <DialogTitle className="sr-only">More Info</DialogTitle>
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex-1 overflow-hidden [padding-bottom:env(safe-area-inset-bottom)]">
            {children}
          </div>
          {footer && (
            <div className="border-border bg-background/80 supports-[backdrop-filter]:bg-background/60 z-10 border-t px-4 py-3 backdrop-blur sm:px-6">
              {footer}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

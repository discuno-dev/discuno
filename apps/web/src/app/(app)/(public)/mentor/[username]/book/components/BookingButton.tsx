'use client'

import Image from 'next/image'
import { Suspense, useState } from 'react'
import { BookingEmbed } from '~/app/(app)/(public)/mentor/[username]/book/components/BookingEmbed'
import { BookingEmbedSkeleton } from '~/app/(app)/(public)/mentor/[username]/book/components/BookingEmbedSkeleton'
import type { BookingData } from '~/app/(app)/(public)/mentor/[username]/book/components/BookingInterface'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog'

interface BookingButtonProps {
  bookingData: BookingData
  children: React.ReactNode
  className?: string
}

export const BookingButton = ({ bookingData, children, className }: BookingButtonProps) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className={className}>
        {children}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="aspect-[9/16] max-h-[85vh] w-full max-w-[85vw] overflow-hidden p-0 focus:outline-none sm:rounded-xl">
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="animate-in fade-in slide-in-from-top-2 flex-shrink-0 p-6 pb-0 duration-200">
              <DialogTitle className="text-xl font-semibold">
                Schedule with {bookingData.name}
              </DialogTitle>
              <div className="mt-2 flex items-center gap-3">
                {bookingData.image && (
                  <Image
                    src={bookingData.image}
                    alt={bookingData.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                )}
                <div>
                  <p className="text-muted-foreground text-sm">
                    {bookingData.school} • {bookingData.major}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-hidden [padding-bottom:env(safe-area-inset-bottom)]">
              <div className="animate-in fade-in h-full overflow-y-auto duration-200">
                <Suspense fallback={<BookingEmbedSkeleton />}>
                  <BookingEmbed bookingData={bookingData} />
                </Suspense>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

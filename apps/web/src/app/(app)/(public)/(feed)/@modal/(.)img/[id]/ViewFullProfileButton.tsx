'use client'

import { ExternalLink } from 'lucide-react'
import { Button } from '~/components/ui/button'

interface ViewFullProfileButtonProps {
  postId: number
  className?: string
}

export function ViewFullProfileButton({ postId, className }: ViewFullProfileButtonProps) {
  const handleClick = () => {
    // Force a hard navigation to bypass the modal intercept
    window.location.href = `/img/${postId}`
  }

  return (
    <Button variant="secondary" className={className} onClick={handleClick}>
      <ExternalLink className="mr-2 h-4 w-4" />
      View Full Profile
    </Button>
  )
}

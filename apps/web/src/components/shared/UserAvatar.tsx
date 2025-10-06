'use client'

import { HelpCircle, LogIn, Settings, User } from 'lucide-react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Button } from '~/components/ui/button'

import { ModeToggle } from '~/app/(app)/(layout)/nav/ThemeToggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

const AvatarPic = ({ profilePic }: { profilePic: string | null }) => {
  return (
    <div className="h-10 w-10">
      <Avatar>
        <AvatarImage src={profilePic ?? undefined} alt="Profile Picture" width={40} height={40} />
        <AvatarFallback>
          <User className="h-5 w-5" />
        </AvatarFallback>
      </Avatar>
    </div>
  )
}

interface AvatarIconProps {
  profilePic: string | null
  isAuthenticated?: boolean
}

export const AvatarIcon = ({ profilePic, isAuthenticated = false }: AvatarIconProps) => {
  // Show login button for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="flex flex-row items-center justify-end space-x-4">
        <ModeToggle />
        <Button asChild variant="default" size="sm">
          <Link href="/auth" className="flex items-center gap-2">
            <LogIn className="h-4 w-4" />
            Sign In
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-row items-center justify-end space-x-4">
      <ModeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="focus:ring-primary h-10 w-10 rounded-full focus:ring-2"
            aria-label="User menu"
          >
            <AvatarPic profilePic={profilePic} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <Link href="/settings/event-types">
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
          </Link>
          <Link href="/help">
            <DropdownMenuItem>
              <HelpCircle className="mr-2 h-4 w-4" />
              Help Center
            </DropdownMenuItem>
          </Link>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              try {
                await signOut({ callbackUrl: '/auth' })
              } catch (error) {
                console.error('Sign out error:', error)
                // Fallback redirect
                window.location.href = '/auth'
              }
            }}
            className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
          >
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

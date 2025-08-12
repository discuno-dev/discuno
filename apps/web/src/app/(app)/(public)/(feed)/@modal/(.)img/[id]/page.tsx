import { Calendar, Clock, ExternalLink, GraduationCap, School, User } from 'lucide-react'
import Link from 'next/link'
import { Modal } from '~/app/(app)/(public)/(feed)/@modal/(.)img/[id]/modal'
import { BookingInterface } from '~/app/(app)/(public)/mentor/[username]/book/components/BookingInterface'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'
import { getPostById } from '~/server/queries'

const PostModal = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id: postId } = await params
  const idAsNumber = Number(postId)

  if (Number.isNaN(idAsNumber)) {
    throw new Error('Invalid post ID')
  }

  const post = await getPostById(idAsNumber)

  const footer = (
    <div className="flex flex-row gap-2">
      {post.createdById && (
        <BookingInterface variant="modal" className="min-w-0 flex-1" userId={post.createdById}>
          <Calendar className="mr-2 h-4 w-4" />
          <span className="inline sm:hidden">Book</span>
          <span className="hidden sm:inline">Schedule Meeting</span>
        </BookingInterface>
      )}
      <Button variant="secondary" asChild className="min-w-0 flex-1">
        <Link href={`/img/${post.id}`} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="mr-2 h-4 w-4" />
          <span className="inline sm:hidden">Full Profile</span>
          <span className="hidden sm:inline">View Full Profile</span>
        </Link>
      </Button>
    </div>
  )

  return (
    <Modal footer={footer}>
      <div className="w-full">
        {/* Header */}
        <div className="rounded-t-xl px-6 pt-6">
          <div className="flex items-end gap-4 pb-5">
            <Avatar className="border-border h-14 w-14 border-2 shadow-md">
              <AvatarImage src={post.userImage ?? ''} alt={post.name ?? ''} />
              <AvatarFallback className="bg-primary text-primary-foreground text-base font-bold">
                {post.name?.charAt(0) ?? 'S'}
              </AvatarFallback>
            </Avatar>
            <div className="text-foreground">
              <h1 className="text-balance text-xl font-bold leading-tight sm:text-2xl">
                {post.name ?? 'Student Name'}
              </h1>
              {post.schoolYear && (
                <Badge variant="secondary" className="mt-1">
                  {post.schoolYear}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="space-y-5 p-6">
          {/* Academic Info */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
              <School className="text-primary h-5 w-5" />
              <div>
                <p className="text-muted-foreground hidden text-sm sm:inline">University</p>
                <p className="text-foreground font-semibold">{post.school}</p>
              </div>
            </div>

            <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
              <GraduationCap className="text-primary h-5 w-5" />
              <div>
                <p className="text-muted-foreground hidden text-sm sm:inline">Major</p>
                <p className="text-foreground font-semibold">{post.major}</p>
              </div>
            </div>
          </div>

          {/* Bio Section */}
          {post.description && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="text-primary h-4 w-4" />
                <h3 className="text-foreground font-semibold">About</h3>
              </div>
              <p className="text-muted-foreground line-clamp-3 pl-6 leading-relaxed">
                {post.description}
              </p>
            </div>
          )}

          <Separator />

          {/* Timeline Info */}
          <div className="flex items-center justify-between text-sm">
            <div className="text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Class of {post.graduationYear}</span>
            </div>
            <div className="text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                Joined{' '}
                {new Date(post.createdAt ?? '').toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
          {/* Actions moved to sticky footer via Modal.footer prop */}
        </div>
      </div>
    </Modal>
  )
}

export default PostModal

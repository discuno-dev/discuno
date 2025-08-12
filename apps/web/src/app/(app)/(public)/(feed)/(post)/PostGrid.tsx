'use client'

import { Suspense, useEffect, useState } from 'react'
import { PostCard } from '~/app/(app)/(public)/(feed)/(post)/PostCard'
import {
  fetchPostsAction,
  fetchPostsByFilterAction,
} from '~/app/(app)/(public)/(feed)/(post)/actions'
import type { Card } from '~/app/types'
import { AspectRatio } from '~/components/ui/aspect-ratio'
import { Skeleton } from '~/components/ui/skeleton'

// Define the PostGridProps interface
interface PostGridProps {
  posts: Card[]
  schoolId: number | null
  majorId: number | null
  graduationYear: number | null
}

interface PostsResponse {
  posts: Card[]
  nextCursor?: number
  hasMore: boolean
}

const PostGridSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="flex flex-col space-y-3">
          <AspectRatio ratio={16 / 9}>
            <Skeleton className="h-full w-full rounded-lg" />
          </AspectRatio>
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

const FilteredPosts = ({ posts, loading }: { posts: Card[]; loading: boolean }) => {
  if (loading) return <PostGridSkeleton />

  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {posts.map(card => (
        <PostCard key={card.id} card={card} index={card.id ?? 0} />
      ))}
    </div>
  )
}

// PostGrid component
export const PostGrid = ({ posts, schoolId, majorId, graduationYear }: PostGridProps) => {
  // State to manage all posts
  const [allPosts, setAllPosts] = useState<Card[]>(posts)
  // State to manage loading status
  const [loading, setLoading] = useState<boolean>(false)
  // State to manage cursor for pagination
  const [nextCursor, setNextCursor] = useState<number | undefined>(undefined)
  // State to track if there are more posts
  const [hasMore, setHasMore] = useState<boolean>(true)
  // Limit for the number of posts to fetch at a time
  const limit = 12

  useEffect(() => {
    // Effect to fetch posts when filter parameters change
    const fetchFilteredPosts = async () => {
      try {
        setLoading(true)
        const result: PostsResponse =
          schoolId || majorId || graduationYear
            ? await fetchPostsByFilterAction(schoolId, majorId, graduationYear, limit)
            : await fetchPostsAction(limit)

        setAllPosts(result.posts)
        setNextCursor(result.nextCursor)
        setHasMore(result.hasMore)
      } catch (error) {
        console.error('Error fetching filtered posts:', error)
        setHasMore(false)
      } finally {
        setLoading(false)
      }
    }

    void fetchFilteredPosts()
  }, [schoolId, majorId, graduationYear])

  // Function to load more posts
  const loadMorePosts = async () => {
    if (!hasMore || loading) return

    setLoading(true)
    try {
      const result: PostsResponse =
        schoolId || majorId || graduationYear
          ? await fetchPostsByFilterAction(schoolId, majorId, graduationYear, limit, nextCursor)
          : await fetchPostsAction(limit, nextCursor)

      // Filter out duplicates using Set for better performance
      const existingIds = new Set(allPosts.map(post => post.id))
      const uniqueNewPosts = result.posts.filter(post => !existingIds.has(post.id))

      setAllPosts(prevPosts => [...prevPosts, ...uniqueNewPosts])
      setNextCursor(result.nextCursor)
      setHasMore(result.hasMore)
    } catch (error) {
      console.error('Error loading more posts:', error)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-foreground mb-8 text-center text-3xl font-bold">
        Find Your College Mentor
      </h1>
      <Suspense fallback={<PostGridSkeleton />}>
        <FilteredPosts posts={allPosts} loading={loading} />
      </Suspense>
      {allPosts.length > 0 && hasMore && (
        <div className="mt-12 flex justify-center">
          <button
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary rounded-full px-8 py-3 transition-all duration-300 focus:ring-2 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-gray-900"
            onClick={loadMorePosts}
            disabled={loading}
            aria-label={loading ? 'Loading more mentors...' : 'Load more mentors'}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Loading...
              </span>
            ) : (
              'Load More Mentors'
            )}
          </button>
        </div>
      )}
    </div>
  )
}

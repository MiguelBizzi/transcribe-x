import { Skeleton } from '@/components/ui/skeleton'

export default function TranscriptionDetailLoading() {
  return (
    <div className="flex flex-1 flex-col gap-8 px-6 py-8">
      <Skeleton className="h-4 w-40" />
      <div className="flex flex-col gap-6 md:flex-row">
        <Skeleton className="aspect-video w-full rounded-xl md:w-80" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  )
}

import { ReviewTransfer } from "@/components/review-transfer"

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ReviewTransfer id={id} />
}

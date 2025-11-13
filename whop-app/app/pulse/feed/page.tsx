import { getUserAuth } from '@/lib/auth';
import { getCreatorForCompany } from '@/lib/creator';
import FeedContent from './FeedContent';
import { notFound } from 'next/navigation';

export default async function PublicFeedPage() {
  // Check if user is authenticated and a creator (but don't require it)
  const auth = await getUserAuth();
  
  if (!auth.companyId) {
    throw new Error('Company ID not found');
  }

  // Get the creator for this company dynamically
  const creator = await getCreatorForCompany(auth.companyId);
  
  if (!creator) {
    notFound();
  }
  
  return <FeedContent creatorId={creator.id} creatorName={creator.name} isCreator={auth.isCreator} />;
}

// Type exports for the client component
export interface MessageWithRelations {
  id: string;
  message: string;
  tag: string;
  product_category?: string;
  created_at: string;
  creator_id: string;
  company_id: string;
  reviewed?: boolean;
  replies: Array<{
    id: string;
    message_id: string;
    reply_text: string;
    is_public: boolean;
    created_at: string;
  }>;
  reaction_count: number;
}

export type SortOption = 'newest' | 'most_reacted' | 'most_replied';

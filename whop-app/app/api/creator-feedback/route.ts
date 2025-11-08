import { NextRequest, NextResponse } from 'next/server';
import { requireCreator } from '@/lib/auth';
import { getCreatorForCompany } from '@/lib/creator';
import { supabaseAdmin, CreatorFeedbackCategory } from '@/lib/supabase';

const ALLOWED_CATEGORIES: CreatorFeedbackCategory[] = ['bug', 'feedback', 'idea', 'other'];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCreator();

    if (!auth.companyId) {
      return NextResponse.json(
        { error: 'Company ID missing' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { category, message, subject } = body ?? {};

    if (!category || !ALLOWED_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const creator = await getCreatorForCompany(auth.companyId);

    if (!creator) {
      return NextResponse.json(
        { error: 'Creator not found for company' },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('creator_feedback')
      .insert({
        creator_id: creator.id,
        company_id: auth.companyId,
        user_id: auth.userId,
        category,
        subject: subject?.trim() || null,
        message: message.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting creator feedback:', error);
      return NextResponse.json(
        { error: 'Failed to submit feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('Error handling POST /api/creator-feedback:', error);
    const message = typeof error?.message === 'string' ? error.message : '';
    if (message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

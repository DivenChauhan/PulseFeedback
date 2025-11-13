import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserAuth } from '@/lib/auth';

// GET /api/analytics?creatorId=xxx&period=week|month|all
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const creatorId = searchParams.get('creatorId');
    const period = searchParams.get('period') || 'all'; // week, month, all

    if (!creatorId) {
      return NextResponse.json(
        { error: 'Creator ID is required' },
        { status: 400 }
      );
    }

    // Get company ID from environment (set by Whop for this app installation)
    const companyId = process.env.NEXT_PUBLIC_WHOP_COMPANY_ID;
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'Company configuration missing' },
        { status: 500 }
      );
    }

    // Verify user has access to this company (must be creator for analytics)
    const auth = await getUserAuth();
    if (!auth.isCreator || !auth.hasCompanyAccess) {
      return NextResponse.json(
        { error: 'Unauthorized: Creator access required' },
        { status: 403 }
      );
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date | null = null;

    if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Build base query
    let messagesQuery = supabase
      .from('messages')
      .select(`
        *,
        replies(id, is_public),
        reactions(id, reaction_type)
      `)
      .eq('creator_id', creatorId)
      .eq('company_id', companyId);

    if (startDate) {
      messagesQuery = messagesQuery.gte('created_at', startDate.toISOString());
    }

    const { data: messages, error } = await messagesQuery;

    if (error) {
      console.error('Error fetching analytics data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch analytics data' },
        { status: 500 }
      );
    }

    // Calculate analytics
    const totalMessages = messages.length;
    const totalReactions = messages.reduce((sum, m) => sum + (m.reactions?.length || 0), 0);
    const totalReplies = messages.reduce((sum, m) => sum + (m.replies?.length || 0), 0);
    const averageReactionsPerMessage = totalMessages > 0 ? totalReactions / totalMessages : 0;

    // Tag distribution
    const tagDistribution = messages.reduce((acc, m) => {
      acc[m.tag] = (acc[m.tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Product category distribution (legacy)
    const productCategoryDistribution = messages.reduce((acc, m) => {
      if (m.product_category) {
        acc[m.product_category] = (acc[m.product_category] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Reaction type distribution
    const reactionTypeDistribution = messages.reduce((acc, m) => {
      m.reactions?.forEach((r: any) => {
        acc[r.reaction_type] = (acc[r.reaction_type] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    // Messages per day (for trends chart)
    const messagesPerDay = messages.reduce((acc, m) => {
      const date = new Date(m.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Sort by date
    const sortedDates = Object.keys(messagesPerDay).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });

    const messagesTrend = sortedDates.map(date => ({
      date,
      count: messagesPerDay[date],
    }));

    // Most active hours
    const hourDistribution = messages.reduce((acc, m) => {
      const hour = new Date(m.created_at).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Response rate
    const messagesWithReplies = messages.filter(m => m.replies && m.replies.length > 0).length;
    const responseRate =
      totalMessages > 0
        ? Number(((messagesWithReplies / totalMessages) * 100).toFixed(1))
        : 0;

    // Public replies count
    const publicRepliesCount = messages.reduce((sum, m) => {
    const replies = Array.isArray(m.replies) ? m.replies : [];
    const publicReplies = replies.filter((r: any) => r.is_public).length;
      return sum + publicReplies;
    }, 0);

    // Average response time (in hours)
    let averageResponseTime = 0;
    let responseTimes: number[] = [];
    
    // Fetch detailed replies with timestamps for response time calculation
    const { data: repliesData } = await supabase
      .from('replies')
      .select('message_id, created_at');
    
    if (repliesData) {
      messages.forEach(m => {
        const reply = repliesData.find(r => r.message_id === m.id);
        if (reply) {
          const messageTime = new Date(m.created_at).getTime();
          const replyTime = new Date(reply.created_at).getTime();
          const diffHours = (replyTime - messageTime) / (1000 * 60 * 60);
          if (diffHours >= 0) { // Only count positive time differences
            responseTimes.push(diffHours);
          }
        }
      });
    }
    
    if (responseTimes.length > 0) {
      averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    }

    // Unanswered messages older than 3 days
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const oldUnansweredMessages = messages.filter(m => {
      const hasNoReply = !m.replies || m.replies.length === 0;
      const isOld = new Date(m.created_at) < threeDaysAgo;
      return hasNoReply && isOld;
    });

    // Find engagement peak (day with most messages)
    const peakDay = sortedDates.reduce((peak, date) => {
      return messagesPerDay[date] > (messagesPerDay[peak] || 0) ? date : peak;
    }, sortedDates[0] || '');

    const analytics = {
      summary: {
        totalMessages,
        totalReactions,
        totalReplies,
        publicRepliesCount,
        averageReactionsPerMessage,
        responseRate,
        averageResponseTime: averageResponseTime.toFixed(1),
        oldUnansweredCount: oldUnansweredMessages.length,
        peakEngagementDay: peakDay,
        peakEngagementCount: messagesPerDay[peakDay] || 0,
      },
      distributions: {
        tags: tagDistribution,
        productCategories: productCategoryDistribution,
        reactionTypes: reactionTypeDistribution,
        hours: hourDistribution,
      },
      trends: {
        messagesPerDay: messagesTrend,
      },
      oldUnansweredMessages: oldUnansweredMessages.map(m => ({
        id: m.id,
        message: m.message,
        tag: m.tag,
        created_at: m.created_at,
      })),
    };

    return NextResponse.json({ data: analytics }, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


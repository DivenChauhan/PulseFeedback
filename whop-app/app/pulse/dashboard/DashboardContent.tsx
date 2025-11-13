'use client';

import { useEffect, useState, useCallback } from 'react';
import { Message, Reply, ProductCategory, CreatorFeedbackCategory } from '@/lib/supabase';
import { Button, Input, Typography } from '@whop/frosted-ui';
import { 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  MoreVertical,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle,
  XCircle,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import MessageModal from '@/components/MessageModal';
import Navbar from '@/components/Navbar';
import EmojiReactions from '@/components/EmojiReactions';

interface MessageWithReactions extends Message {
  reply?: Reply[];
  reaction_count?: number;
}

type TabType = 'overview' | 'inbox' | 'reviewed';

interface DashboardContentProps {
  creatorId: string;
  creatorSlug: string;
}

export default function DashboardContent({ creatorId, creatorSlug }: DashboardContentProps) {
  // State management
  const [messages, setMessages] = useState<MessageWithReactions[]>([]);
  const [allMessages, setAllMessages] = useState<MessageWithReactions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [filter, setFilter] = useState<'all' | 'question' | 'feedback' | 'confession'>('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState<'all' | ProductCategory>('all');
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<MessageWithReactions | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportCategory, setSupportCategory] = useState<CreatorFeedbackCategory>('bug');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const MESSAGES_PER_PAGE = 10;

  const supportCategories: Array<{
    value: CreatorFeedbackCategory;
    label: string;
    helper: string;
  }> = [
    { value: 'bug', label: '🐛 Bug or Issue', helper: 'Something is broken or not working as expected' },
    { value: 'feedback', label: '💡 Feedback', helper: 'Share thoughts on the experience or workflow' },
    { value: 'idea', label: '🚀 Idea', helper: 'Suggest improvements or features for Pulse' },
    { value: 'other', label: '📝 Other', helper: 'Anything else you want to pass along' },
  ];

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch ALL messages (without reviewed filter) for proper tab management
      const params = new URLSearchParams({ creatorId });
      if (filter !== 'all') params.append('tag', filter);
      if (productCategoryFilter !== 'all') params.append('productCategory', productCategoryFilter);

      const response = await fetch(`/api/feedback?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      const { data } = await response.json();
      setMessages(data || []);

      // Also fetch ALL messages (without filters) with reaction counts for hot posts
      // Use feedback API so creators see all their replies (public + private)
      const allMessagesResponse = await fetch(`/api/feedback?creatorId=${creatorId}`);
      if (allMessagesResponse.ok) {
        const { data: allMessagesData } = await allMessagesResponse.json();
        
        // Get reaction counts for each message
        const messagesWithReactions = await Promise.all(
          (allMessagesData || []).map(async (message: any) => {
            const reactionResponse = await fetch(`/api/reactions?messageId=${message.id}&userHash=count_only`);
            let reactionCount = 0;
            
            if (reactionResponse.ok) {
              const reactionData = await reactionResponse.json();
              reactionCount = reactionData.data?.length || 0;
            }
            
            return {
              ...message,
              reaction_count: reactionCount,
            };
          })
        );
        
        // Sort by reaction count (descending), then by created_at (descending) - same as feed
        const sortedMessages = messagesWithReactions.sort((a, b) => {
          const reactionDiff = (b.reaction_count || 0) - (a.reaction_count || 0);
          if (reactionDiff !== 0) return reactionDiff;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        
        setAllMessages(sortedMessages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [creatorId, filter, productCategoryFilter]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const resetSupportForm = () => {
    setSupportCategory('bug');
    setSupportSubject('');
    setSupportMessage('');
    setSupportSuccess(null);
    setSupportError(null);
  };

  const handleOpenSupportModal = () => {
    resetSupportForm();
    setIsSupportModalOpen(true);
  };

  const handleCloseSupportModal = () => {
    setIsSupportModalOpen(false);
  };

  const handleSubmitSupportFeedback = async () => {
    if (!supportMessage.trim()) {
      setSupportError('Please add some details so we can help effectively.');
      return;
    }

    setSupportSubmitting(true);
    setSupportError(null);

    try {
      const response = await fetch('/api/creator-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: supportCategory,
          subject: supportSubject.trim() || undefined,
          message: supportMessage.trim(),
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to submit feedback');
      }

      setSupportSuccess('Thanks! Your note is on its way to the Pulse team.');
      setSupportSubject('');
      setSupportMessage('');
    } catch (error: any) {
      console.error('Error submitting creator feedback:', error);
      setSupportError(error?.message || 'Something went wrong. Please try again.');
    } finally {
      setSupportSubmitting(false);
    }
  };

  const handleMarkReviewed = async (id: string, reviewed: boolean) => {
    try {
      const response = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed }),
      });

      if (!response.ok) throw new Error('Failed to update message');
      await fetchMessages();
    } catch (error) {
      console.error('Error updating message:', error);
      alert('Failed to update message');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/feedback/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete message');
      await fetchMessages();
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Failed to delete message');
    }
  };

  const handleReply = async (messageId: string, replyText: string, isPublic: boolean) => {
    try {
      const response = await fetch('/api/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, replyText, isPublic }),
      });

      if (!response.ok) throw new Error('Failed to submit reply');
      await fetchMessages();
    } catch (error) {
      console.error('Error submitting reply:', error);
      alert('Failed to submit reply');
    }
  };

  const handleToggleReplyVisibility = async (replyId: string, isPublic: boolean) => {
    try {
      const response = await fetch(`/api/replies/${replyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic }),
      });

      if (!response.ok) throw new Error('Failed to update reply visibility');
      await fetchMessages();
    } catch (error) {
      console.error('Error updating reply visibility:', error);
      alert('Failed to update reply visibility');
    }
  };

  const copyFeedbackLink = () => {
    const link = `${origin}/p/${creatorSlug}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleCardExpansion = (messageId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const toggleDropdown = (messageId: string) => {
    setOpenDropdown(prev => prev === messageId ? null : messageId);
  };

  // Analytics & computed values
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const totalMessages = messages.length;
  const thisWeekMessages = messages.filter(m => new Date(m.created_at) >= oneWeekAgo).length;
  const pendingMessages = messages.filter(m => !m.reviewed && (!m.reply || m.reply.length === 0));
  
  // Inbox: messages without replies (not yet handled)
  const inboxMessages = messages.filter(m => !m.reply || m.reply.length === 0);
  
  // Reviewed: messages with replies OR manually marked as reviewed
  const reviewedMessages = messages.filter(m => (m.reply && m.reply.length > 0) || m.reviewed);
  
  const repliedMessages = messages.filter(m => m.reply && m.reply.length > 0).length;

  const oldUnansweredMessages = messages.filter(m => {
    const hasNoReply = !m.reply || m.reply.length === 0;
    const isOld = new Date(m.created_at) < threeDaysAgo;
    return hasNoReply && isOld && !m.reviewed;
  });

  // Filter messages based on active tab
  const getFilteredMessages = () => {
    if (activeTab === 'inbox') return inboxMessages;
    if (activeTab === 'reviewed') return reviewedMessages;
    return messages;
  };

  const filteredMessages = getFilteredMessages();
  const totalPages = Math.ceil(filteredMessages.length / MESSAGES_PER_PAGE);
  const paginatedMessages = filteredMessages.slice(
    (currentPage - 1) * MESSAGES_PER_PAGE,
    currentPage * MESSAGES_PER_PAGE
  );

  // Color-coded label helper
  // Simple gray styling for all badges - matches feed page
  const getTagBadgeStyle = () => 'bg-white/[0.08] text-white border border-white/[0.1]';

  const getTagLabel = (tag: string) => {
    const labels = {
      question: '❓ Question',
      feedback: '💬 Feedback',
      confession: '🤫 Confession',
    };
    return labels[tag as keyof typeof labels] || tag;
  };

  const getCategoryLabel = (category?: string) => {
    if (!category) return null;
    const labels = {
      main_product: '🚀 Product',
      service: '⚡ Service',
      feature_request: '🎁 Feature',
      bug_report: '🐛 Bug',
      other: '📝 Other',
    };
    return labels[category as keyof typeof labels] || category;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Navbar isCreator={true} />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header with Tabs */}
        <div className="mb-8">
          <Typography as="h1" variant="display-sm" className="text-white mb-2 font-bold">
            Dashboard
          </Typography>
          <Typography as="p" variant="body" className="text-white mb-6">
            Manage your anonymous messages
          </Typography>

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-white/10">
            <button
              onClick={() => {
                setActiveTab('overview');
                setCurrentPage(1);
              }}
              className={`px-6 py-3 font-medium transition-all relative ${
                activeTab === 'overview'
                  ? 'text-blue-400'
                  : 'text-white hover:text-blue-300'
              }`}
            >
              Overview
              {activeTab === 'overview' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('inbox');
                setCurrentPage(1);
              }}
              className={`px-6 py-3 font-medium transition-all relative ${
                activeTab === 'inbox'
                  ? 'text-blue-400'
                  : 'text-white hover:text-blue-300'
              }`}
            >
              Inbox
              {inboxMessages.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded-full">
                  {inboxMessages.length}
                </span>
              )}
              {activeTab === 'inbox' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('reviewed');
                setCurrentPage(1);
              }}
              className={`px-6 py-3 font-medium transition-all relative ${
                activeTab === 'reviewed'
                  ? 'text-blue-400'
                  : 'text-white hover:text-blue-300'
              }`}
            >
              Reviewed
              {reviewedMessages.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-white/10 text-white rounded-full">
                  {reviewedMessages.length}
                </span>
              )}
              {activeTab === 'reviewed' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>
              )}
            </button>
          </div>
        </div>

        {/* Key Metrics Summary - Always Visible */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/[0.03] rounded-xl p-5 hover:bg-white/[0.05] transition-all border border-white/[0.05]">
            <Typography as="p" variant="body-sm" className="text-white mb-1 font-medium text-sm">
              Total
            </Typography>
            <Typography as="p" variant="title" className="text-white font-bold">
              {totalMessages}
            </Typography>
          </div>
          <div className="bg-white/[0.03] rounded-xl p-5 hover:bg-white/[0.05] transition-all border border-white/[0.05]">
            <Typography as="p" variant="body-sm" className="text-white mb-1 font-medium text-sm">
              This Week
            </Typography>
            <Typography as="p" variant="title" className="text-white font-bold">
              {thisWeekMessages}
            </Typography>
          </div>
          <div className="bg-white/[0.03] rounded-xl p-5 hover:bg-white/[0.05] transition-all border border-white/[0.05]">
            <Typography as="p" variant="body-sm" className="text-white mb-1 font-medium text-sm">
              Pending
            </Typography>
            <Typography as="p" variant="title" className="text-white font-bold">
              {pendingMessages.length}
            </Typography>
          </div>
          <div className="bg-white/[0.03] rounded-xl p-5 hover:bg-white/[0.05] transition-all border border-white/[0.05]">
            <Typography as="p" variant="body-sm" className="text-white mb-1 font-medium text-sm">
              Replied
            </Typography>
            <Typography as="p" variant="title" className="text-white font-bold">
              {repliedMessages}
            </Typography>
          </div>
        </div>

        {/* Overview Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6 mb-8">
            {/* Share Link */}
            <div className="bg-white/[0.03] rounded-xl p-6 border border-white/[0.05]">
              <Typography as="h2" variant="title-sm" className="text-white mb-2 font-semibold">
                📢 Share Your Link
              </Typography>
              <Typography as="p" variant="body-sm" className="text-white mb-4">
                Share this link to collect anonymous messages
              </Typography>
              <div className="flex gap-3">
                <Input
                  isReadOnly
                  value={`${origin}/p/${creatorSlug}`}
                  className="flex-1 text-base text-white bg-white/[0.05] border-white/[0.1]"
                />
                <Button onClick={copyFeedbackLink} size="md" variant="primary" className="!text-white">
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Hot Posts Section */}
            {allMessages.filter(m => (m.reaction_count || 0) >= 5).length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🔥</span>
                  <Typography as="h2" variant="title-sm" className="text-white font-bold">
                    Hot Posts
                  </Typography>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {allMessages
                    .filter(m => (m.reaction_count || 0) >= 5)
                    .slice(0, 4)
                    .map((message) => {
                      const messageAge = Date.now() - new Date(message.created_at).getTime();
                      const isNew = messageAge < 24 * 60 * 60 * 1000;
                      const hasReply = Array.isArray(message.reply) && message.reply.length > 0;

                      return (
                        <div
                          key={message.id}
                          onClick={() => setSelectedMessage(message)}
                          className="bg-gradient-to-br from-white/[0.05] to-orange-500/10 rounded-xl p-5 border border-orange-500/20 hover:border-orange-500/40 transition-all cursor-pointer group"
                        >
                          <div className="flex items-start gap-3 mb-3">
                            <div className="text-4xl font-bold text-white">
                              {message.reaction_count || 0}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 bg-orange-500/20 text-white text-xs font-semibold rounded-md border border-white">
                                  🔥 Hot
                                </span>
                                {isNew && (
                                  <span className="px-2 py-0.5 bg-purple-500/30 text-white text-xs font-semibold rounded-md border border-white">
                                    ✨ New
                                  </span>
                                )}
                                {hasReply && (
                                  <span className="px-2 py-0.5 bg-white/[0.08] text-white text-xs font-semibold rounded-md border border-white/[0.1]">
                                    💬 Replied
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Typography as="p" variant="body-sm" className="!text-white mb-2 line-clamp-2">
                            {message.message}
                          </Typography>
                          <Typography as="span" variant="body-sm" className="!text-white text-xs">
                            {new Date(message.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Typography>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Alert for old messages */}
            {oldUnansweredMessages.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <Typography as="h3" variant="title-sm" className="text-yellow-400 mb-1 text-sm">
                      {oldUnansweredMessages.length} Message{oldUnansweredMessages.length !== 1 ? 's' : ''} Need Attention
                    </Typography>
                    <Typography as="p" variant="body-sm" className="text-yellow-200/80 text-xs">
                      These messages are older than 3 days and haven't received a reply yet.
                    </Typography>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Horizontal Filter Bar - Only show on Inbox and Reviewed tabs */}
        {(activeTab === 'inbox' || activeTab === 'reviewed') && (
          <div className="bg-white/[0.03] rounded-xl p-4 mb-6 border border-white/[0.05]">
            <div className="flex flex-wrap items-center gap-4">
              <Typography as="span" variant="body-sm" className="text-white font-medium text-xs">
                Filter by:
              </Typography>
              
              {/* Message Type Filter */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all text-sm ${
                    filter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/[0.05] text-white hover:bg-white/[0.1]'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('question')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all text-sm ${
                    filter === 'question'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/[0.05] text-white hover:bg-white/[0.1]'
                  }`}
                >
                  ❓ Questions
                </button>
                <button
                  onClick={() => setFilter('feedback')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all text-sm ${
                    filter === 'feedback'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/[0.05] text-white hover:bg-white/[0.1]'
                  }`}
                >
                  💬 Feedback
                </button>
                <button
                  onClick={() => setFilter('confession')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all text-sm ${
                    filter === 'confession'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/[0.05] text-white hover:bg-white/[0.1]'
                  }`}
                >
                  🤫 Confessions
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Messages List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <Typography as="h2" variant="title-sm" className="text-white font-bold">
              {activeTab === 'overview' ? 'All Messages' : activeTab === 'inbox' ? 'Inbox' : 'Reviewed'}
              <span className="ml-2 text-white text-sm font-normal">
                ({filteredMessages.length})
              </span>
            </Typography>
            {filteredMessages.length > MESSAGES_PER_PAGE && (
              <Typography as="span" variant="body-sm" className="text-white">
                Page {currentPage} of {totalPages}
              </Typography>
            )}
          </div>
          
          {isLoading ? (
            <div className="bg-white/[0.03] rounded-xl p-16 text-center border border-white/[0.05]">
              <Typography as="p" variant="body" className="text-white">
                Loading messages...
              </Typography>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="bg-white/[0.03] rounded-xl p-16 text-center border border-white/[0.05]">
              <Typography as="p" variant="title-sm" className="text-white mb-2">
                No messages yet
              </Typography>
              <Typography as="p" variant="body-sm" className="text-white">
                {activeTab === 'inbox' 
                  ? 'All caught up! No new messages to review.'
                  : activeTab === 'reviewed'
                  ? 'No reviewed messages yet.'
                  : 'Share your link to start receiving anonymous messages'}
              </Typography>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedMessages.map((message) => {
                  const isExpanded = expandedCards.has(message.id);
                  const reply = Array.isArray(message.reply) ? message.reply[0] : undefined;
                  const hasReply = Boolean(reply);

                  return (
                    <div
                      key={message.id}
                      className="bg-white/[0.03] rounded-xl border border-white/[0.05] hover:bg-white/[0.04] transition-all"
                    >
                      {/* Card Header - Always Visible */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            {/* Tags */}
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className={`px-2 py-0.5 text-xs rounded-md ${getTagBadgeStyle()}`}>
                                {getTagLabel(message.tag)}
                              </span>
                              {message.product_category && (
                                <span className={`px-2 py-0.5 text-xs rounded-md ${getTagBadgeStyle()}`}>
                                  {getCategoryLabel(message.product_category)}
                                </span>
                              )}
                              {reply && (
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-white/[0.08] text-white border border-white/[0.1]">
                                  💬 Replied
                                </span>
                              )}
                              {message.reviewed && (
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-white/[0.08] text-white border border-white/[0.1]">
                                  Reviewed
                                </span>
                              )}
                            </div>

                            {/* Message Preview */}
                            <Typography as="p" variant="body" className="!text-white line-clamp-2 text-sm mb-2">
                              {message.message}
                            </Typography>

                            {/* Metadata */}
                            <Typography as="span" variant="body-sm" className="!text-white text-xs">
                              {new Date(message.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleCardExpansion(message.id)}
                              className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition-all text-white"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                            
                            {/* Dropdown Menu */}
                            <div className="relative">
                              <button
                                onClick={() => toggleDropdown(message.id)}
                                className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition-all text-white"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              
                              {openDropdown === message.id && (
                                <div className="absolute right-0 top-full mt-2 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl z-10 min-w-[180px]">
                                  <button
                                    onClick={() => {
                                      handleMarkReviewed(message.id, !message.reviewed);
                                      setOpenDropdown(null);
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/[0.05] transition-all flex items-center gap-2"
                                  >
                                    {message.reviewed ? (
                                      <>
                                        <XCircle className="w-4 h-4" />
                                        Unmark Reviewed
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="w-4 h-4" />
                                        Mark Reviewed
                                      </>
                                    )}
                                  </button>
                                  {reply && (
                                    <button
                                      onClick={() => {
                                        handleToggleReplyVisibility(reply.id, !reply.is_public);
                                        setOpenDropdown(null);
                                      }}
                                      className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/[0.05] transition-all flex items-center gap-2 border-t border-white/5"
                                    >
                                      {reply.is_public ? (
                                        <>
                                          <EyeOff className="w-4 h-4" />
                                          Make Reply Private
                                        </>
                                      ) : (
                                        <>
                                          <Eye className="w-4 h-4" />
                                          Make Reply Public
                                        </>
                                      )}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      if (confirm('Delete this message? This cannot be undone.')) {
                                        handleDelete(message.id);
                                      }
                                      setOpenDropdown(null);
                                    }}
                                    className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-2 border-t border-white/5 rounded-b-lg"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Message
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quick Reply Button - Bottom Right */}
                        {!hasReply && !isExpanded && (
                          <div className="flex justify-end">
                            <Button
                              onClick={() => setSelectedMessage(message)}
                              size="sm"
                              variant="primary"
                              className="!text-white text-xs"
                            >
                              Reply
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t border-white/[0.05] p-4 space-y-4">
                          {/* Full Message */}
                          <div>
                            <Typography as="p" variant="body-sm" className="!text-white mb-2 text-xs font-medium">
                              Full Message
                            </Typography>
                            <Typography as="p" variant="body" className="!text-white whitespace-pre-wrap">
                              {message.message}
                            </Typography>
                          </div>

                          {/* Reactions */}
                          <div>
                            <Typography as="p" variant="body-sm" className="!text-white mb-2 text-xs font-medium">
                              Reactions
                            </Typography>
                            <EmojiReactions 
                              messageId={message.id}
                            />
                          </div>

                          {/* Reply Section */}
                          {reply ? (
                            <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/30">
                              <div className="flex items-center justify-between mb-2">
                                <Typography as="span" variant="body-sm" className="!text-white font-semibold">
                                  Your Reply
                                </Typography>
                                <span className={`px-2 py-0.5 text-xs rounded-md border ${
                                  reply.is_public 
                                    ? 'bg-green-500/20 text-green-300 border-green-500/30' 
                                    : 'bg-white/10 text-white border-white/20'
                                }`}>
                                  {reply.is_public ? '👁️ Public' : '🔒 Private'}
                                </span>
                              </div>
                              <Typography as="p" variant="body" className="!text-white">
                                {reply.reply_text}
                              </Typography>
                            </div>
                          ) : (
                            <div>
                              <Button
                                onClick={() => setSelectedMessage(message)}
                                size="md"
                                variant="primary"
                                className="!text-white"
                              >
                                Reply to Message
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/[0.05]">
                  <Typography as="span" variant="body-sm" className="text-white">
                    Showing {((currentPage - 1) * MESSAGES_PER_PAGE) + 1} to {Math.min(currentPage * MESSAGES_PER_PAGE, filteredMessages.length)} of {filteredMessages.length} messages
                  </Typography>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition-all text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        // Show first, last, current, and pages around current
                        const showPage = 
                          page === 1 || 
                          page === totalPages || 
                          (page >= currentPage - 1 && page <= currentPage + 1);
                        
                        if (!showPage && page === 2) {
                          return <span key={page} className="text-white px-2">...</span>;
                        }
                        if (!showPage && page === totalPages - 1) {
                          return <span key={page} className="text-white px-2">...</span>;
                        }
                        if (!showPage) return null;

                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1.5 rounded-lg transition-all text-sm font-medium ${
                              currentPage === page
                                ? 'bg-blue-600 text-white'
                                : 'bg-white/[0.05] text-white hover:bg-white/[0.1]'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition-all text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Creator Support CTA */}
      <div className="mt-12">
        <div className="bg-gradient-to-r from-white/[0.05] to-blue-500/10 border border-white/[0.08] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
          <div>
            <Typography as="h2" variant="title-sm" className="text-white font-semibold mb-2">
              Need a hand or found something off?
            </Typography>
            <Typography as="p" variant="body-sm" className="text-white/80 text-sm max-w-2xl">
              Send a quick note straight to the Pulse team. Whether it&apos;s a bug, an idea, or feedback, we&apos;ll take a look and get back to you.
            </Typography>
          </div>
          <div className="md:ml-auto">
            <Button
              onClick={handleOpenSupportModal}
              size="md"
              variant="primary"
              className="!text-white px-5"
            >
              Report an Issue or Share Feedback
            </Button>
          </div>
        </div>
      </div>

      {/* Support Modal */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0A0A0A] border border-white/[0.08] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-white/[0.08] sticky top-0 bg-[#0A0A0A]">
              <Typography as="h3" variant="title" className="text-white font-bold">
                Send Feedback to the Pulse Team
              </Typography>
              <button
                onClick={handleCloseSupportModal}
                className="p-2 rounded-lg text-white hover:bg-white/[0.08] transition-colors"
                aria-label="Close support form"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-3">
                <Typography as="p" variant="body-sm" className="text-white text-sm font-medium">
                  What kind of note is this?
                </Typography>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {supportCategories.map((option) => {
                    const isActive = supportCategory === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setSupportCategory(option.value)}
                        className={`text-left p-4 rounded-xl border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] ${
                          isActive
                            ? 'border-blue-500 bg-blue-500/10 text-white'
                            : 'border-white/[0.08] text-white hover:border-white/[0.15]'
                        }`}
                      >
                        <Typography as="p" variant="body-sm" className="text-white font-semibold text-sm">
                          {option.label}
                        </Typography>
                        <Typography as="p" variant="body-sm" className="text-white/60 text-xs mt-1">
                          {option.helper}
                        </Typography>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Typography as="label" variant="body-sm" className="text-white text-sm font-medium">
                  Subject <span className="text-white/40 text-xs font-normal">(optional)</span>
                </Typography>
                <Input
                  value={supportSubject}
                  onChange={(event) => setSupportSubject(event.target.value)}
                  placeholder="Quick summary"
                  className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/40"
                  isDisabled={supportSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Typography as="label" variant="body-sm" className="text-white text-sm font-medium">
                  Details
                </Typography>
                <textarea
                  value={supportMessage}
                  onChange={(event) => setSupportMessage(event.target.value)}
                  placeholder="Let us know what&apos;s happening or what you would like to see. Screenshots, steps to reproduce, or expectations are super helpful."
                  rows={6}
                  className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 py-3 text-white text-sm placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                  disabled={supportSubmitting}
                />
              </div>

              {supportError && (
                <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm rounded-xl px-4 py-3">
                  {supportError}
                </div>
              )}

              {supportSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-sm rounded-xl px-4 py-3">
                  {supportSuccess}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <Button
                  onClick={handleCloseSupportModal}
                  variant="secondary"
                  size="md"
                  className="!text-white"
                  disabled={supportSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitSupportFeedback}
                  variant="primary"
                  size="md"
                  className="!text-white"
                  disabled={supportSubmitting}
                >
                  {supportSubmitting ? 'Sending...' : 'Send to Pulse Team'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {selectedMessage && (
        <MessageModal
          message={selectedMessage}
          isOpen={!!selectedMessage}
          onClose={() => {
            setSelectedMessage(null);
            fetchMessages(); // Refresh messages after closing modal
          }}
          onReply={handleReply}
          onToggleReplyVisibility={handleToggleReplyVisibility}
          onMarkReviewed={handleMarkReviewed}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}


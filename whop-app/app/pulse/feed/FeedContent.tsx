'use client';

import { useEffect, useState, useCallback } from 'react';
import { Typography } from '@whop/frosted-ui';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Plus, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
import EmojiReactions from '@/components/EmojiReactions';
import MessageModal from '@/components/MessageModal';
import MessageForm from '@/components/MessageForm';
import { MessageWithRelations, SortOption } from './page';

interface FeedContentProps {
  creatorId: string;
  creatorName: string;
  isCreator: boolean;
}

export default function FeedContent({ creatorId, creatorName, isCreator }: FeedContentProps) {
  const [messages, setMessages] = useState<MessageWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'question' | 'feedback' | 'confession'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('most_reacted');
  const [selectedMessage, setSelectedMessage] = useState<MessageWithRelations | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [hotPostIndex, setHotPostIndex] = useState(0);
  const MESSAGES_PER_PAGE = 10;

  const fetchMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ creatorId });
      
      if (filter !== 'all') params.append('tag', filter);

      const response = await fetch(`/api/feed?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch messages');

      const { data } = await response.json();
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [creatorId, filter]);

  useEffect(() => {
    fetchMessages();
    setCurrentPage(1);
  }, [fetchMessages]);

  // Auto-rotate hot posts every 5 seconds
  useEffect(() => {
    const hotPostsCount = messages.filter(m => m.reaction_count >= 5).length;
    if (hotPostsCount <= 1) return;

    const interval = setInterval(() => {
      setHotPostIndex(prev => (prev + 1) % Math.min(hotPostsCount, 3));
    }, 5000);

    return () => clearInterval(interval);
  }, [messages]);

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

  const getTagLabel = (tag: string) => {
    const labels = {
      question: '❓ Question',
      feedback: '💬 Feedback',
      confession: '🤫 Confession',
    };
    return labels[tag as keyof typeof labels] || tag;
  };

  // Calculate community pulse metrics
  const totalReactions = messages.reduce((sum, m) => sum + (m.reaction_count || 0), 0);
  const totalReplies = messages.reduce((sum, m) => {
    const replies = Array.isArray(m.replies) ? m.replies : [];
    return sum + replies.filter(r => r.is_public).length;
  }, 0);
  const recentMessages = messages.filter(m => {
    const messageAge = Date.now() - new Date(m.created_at).getTime();
    return messageAge < 24 * 60 * 60 * 1000; // Last 24 hours
  }).length;

  // Activity level: High (>20 reactions), Medium (10-20), Low (<10)
  const activityLevel = totalReactions > 20 ? 'High' : totalReactions > 10 ? 'Medium' : 'Low';
  const activityBadgeStyle = activityLevel === 'High' 
    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg' 
    : activityLevel === 'Medium' 
      ? 'bg-gradient-to-r from-yellow-600 to-orange-500 text-white shadow-lg' 
      : 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg';

  // Sort messages
  const getSortedMessages = (messagesToSort: MessageWithRelations[]) => {
    const sorted = [...messagesToSort];
    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'most_reacted':
        return sorted.sort((a, b) => (b.reaction_count || 0) - (a.reaction_count || 0));
      case 'most_replied':
        return sorted.sort((a, b) => {
          const repliesA = Array.isArray(a.replies) ? a.replies : [];
          const repliesB = Array.isArray(b.replies) ? b.replies : [];
          return repliesB.filter(r => r.is_public).length - repliesA.filter(r => r.is_public).length;
        });
      default:
        return sorted;
    }
  };

  // Separate hot posts (top 3 with most reactions) from regular messages
  const hotPosts = messages.filter(m => m.reaction_count >= 5).slice(0, 3);
  const regularMessages = getSortedMessages(messages.filter(m => !hotPosts.includes(m)));
  
  // Pagination for regular messages
  const totalPages = Math.ceil(regularMessages.length / MESSAGES_PER_PAGE);
  const paginatedMessages = regularMessages.slice(
    (currentPage - 1) * MESSAGES_PER_PAGE,
    currentPage * MESSAGES_PER_PAGE
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Navbar isCreator={isCreator} />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header with Community Pulse */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <Typography as="h1" variant="display-sm" className="!text-white mb-2 font-bold">
                Community Feed
              </Typography>
              <Typography as="p" variant="body" className="!text-white">
                React to messages and help prioritize what gets answered
              </Typography>
            </div>
          </div>

          {/* Community Pulse Metrics */}
          <motion.div 
            className="bg-gradient-to-r from-white/[0.05] to-white/[0.03] rounded-xl p-5 border border-white/[0.08]"
            whileHover={{ scale: 1.01 }}
            animate={{
              boxShadow: ['0 0 15px rgba(59, 130, 246, 0.2)', '0 0 25px rgba(147, 51, 234, 0.25)', '0 0 15px rgba(59, 130, 246, 0.2)'],
            }}
            transition={{ 
              boxShadow: { duration: 3, repeat: Infinity },
              scale: { type: "spring", stiffness: 300 }
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-white" />
              <Typography as="h3" variant="title-sm" className="!text-white font-bold">
                Community Pulse
              </Typography>
              <motion.span 
                className={`ml-auto px-3 py-1 rounded-full text-sm font-semibold ${activityBadgeStyle}`}
                animate={{ 
                  scale: [1, 1.05, 1],
                  boxShadow: activityLevel === 'High' 
                    ? ['0 0 15px rgba(34, 197, 94, 0.5)', '0 0 30px rgba(16, 185, 129, 0.6)', '0 0 15px rgba(34, 197, 94, 0.5)']
                    : activityLevel === 'Medium'
                      ? ['0 0 15px rgba(234, 179, 8, 0.5)', '0 0 30px rgba(249, 115, 22, 0.6)', '0 0 15px rgba(234, 179, 8, 0.5)']
                      : ['0 0 15px rgba(249, 115, 22, 0.5)', '0 0 30px rgba(239, 68, 68, 0.6)', '0 0 15px rgba(249, 115, 22, 0.5)']
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {activityLevel} Activity
              </motion.span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-white/[0.03] rounded-lg">
                <div className="text-2xl font-bold text-white mb-1">{totalReactions}</div>
                <div className="text-xs text-white">Total Reactions</div>
              </div>
              <div className="text-center p-3 bg-white/[0.03] rounded-lg">
                <div className="text-2xl font-bold text-white mb-1">{totalReplies}</div>
                <div className="text-xs text-white">Replies</div>
              </div>
              <div className="text-center p-3 bg-white/[0.03] rounded-lg">
                <div className="text-2xl font-bold text-white mb-1">{recentMessages}</div>
                <div className="text-xs text-white">Last 24h</div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Filters and Sorting */}
        <motion.div 
          className="bg-white/[0.03] rounded-xl p-4 mb-6 border border-white/[0.05]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex flex-wrap items-center gap-4 mb-4">
                <Typography as="span" variant="body-sm" className="!text-white font-medium text-xs">
                  Filter by:
                </Typography>
            <div className="flex flex-wrap gap-2">
              <motion.button
                onClick={() => setFilter('all')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all text-sm ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/[0.05] text-white hover:bg-white/[0.1]'
                }`}
              >
                All
              </motion.button>
              <motion.button
                onClick={() => setFilter('question')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all text-sm ${
                  filter === 'question'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/[0.05] text-white hover:bg-white/[0.1]'
                }`}
              >
                ❓ Questions
              </motion.button>
              <motion.button
                onClick={() => setFilter('feedback')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all text-sm ${
                  filter === 'feedback'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/[0.05] text-white hover:bg-white/[0.1]'
                }`}
              >
                💬 Feedback
              </motion.button>
              <motion.button
                onClick={() => setFilter('confession')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all text-sm ${
                  filter === 'confession'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/[0.05] text-white hover:bg-white/[0.1]'
                }`}
              >
                🤫 Confessions
              </motion.button>
            </div>
          </div>

          {/* Sorting Options */}
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-white/[0.05]">
                <Typography as="span" variant="body-sm" className="!text-white font-medium text-xs">
                  Sort by:
                </Typography>
            <div className="flex flex-wrap gap-2">
              <motion.button
                onClick={() => setSortBy('most_reacted')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all text-sm ${
                  sortBy === 'most_reacted'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/[0.05] text-white hover:bg-white/[0.1]'
                }`}
              >
                🔥 Most Reacted
              </motion.button>
              <motion.button
                onClick={() => setSortBy('newest')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all text-sm ${
                  sortBy === 'newest'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/[0.05] text-white hover:bg-white/[0.1]'
                }`}
              >
                ✨ Newest
              </motion.button>
              <motion.button
                onClick={() => setSortBy('most_replied')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all text-sm ${
                  sortBy === 'most_replied'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/[0.05] text-white hover:bg-white/[0.1]'
                }`}
              >
                💬 Most Replied
              </motion.button>
            </div>
          </div>
        </motion.div>

        {isLoading ? (
          <motion.div 
            className="bg-white/[0.03] rounded-xl p-16 text-center border border-white/[0.05]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
              <Typography as="p" variant="body" className="!text-white">
                Loading messages...
              </Typography>
          </motion.div>
        ) : messages.length === 0 ? (
          <motion.div 
            className="bg-white/[0.03] rounded-xl p-16 text-center border border-white/[0.05]"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
              <Typography as="p" variant="title-sm" className="!text-white mb-2">
                No messages yet
              </Typography>
              <Typography as="p" variant="body-sm" className="!text-white">
                Be the first to leave a message!
              </Typography>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Hot Posts Sidebar */}
            {hotPosts.length > 0 && (
              <motion.div 
                className="lg:col-span-1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="sticky top-24">
                  <div className="flex items-center gap-3 mb-4">
                    <motion.span 
                      className="text-2xl"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      🔥
                    </motion.span>
                    <Typography as="h2" variant="title-sm" className="text-white font-bold">
                      Hot Posts
                    </Typography>
                  </div>

                  {/* Animated Hot Post Carousel */}
                  <div className="relative h-[280px]">
                    <AnimatePresence mode="wait">
                      {hotPosts.slice(hotPostIndex, hotPostIndex + 1).map((message) => {
                        const messageAge = Date.now() - new Date(message.created_at).getTime();
                        const isNew = messageAge < 24 * 60 * 60 * 1000;

                        return (
                          <motion.div
                            key={message.id}
                            onClick={() => setSelectedMessage(message)}
                            className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-orange-500/10 rounded-xl p-5 border border-orange-500/20 hover:border-orange-500/40 transition-all cursor-pointer"
                            initial={{ opacity: 0, rotateY: 90 }}
                            animate={{ opacity: 1, rotateY: 0 }}
                            exit={{ opacity: 0, rotateY: -90 }}
                            transition={{ duration: 0.5 }}
                            whileHover={{ scale: 1.02, y: -4 }}
                          >
                            <div className="flex items-start gap-3 mb-3">
                              <motion.div 
                                className="text-4xl font-bold text-white"
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                              >
                                {message.reaction_count}
                              </motion.div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 bg-orange-500/20 text-white text-xs font-semibold rounded-md border border-white">
                                    🔥 Hot
                                  </span>
                                  {isNew && (
                                    <motion.span 
                                      className="px-2 py-0.5 bg-purple-500/30 text-white text-xs font-semibold rounded-md border border-white inline-block"
                                      animate={{ opacity: [1, 0.7, 1] }}
                                      transition={{ duration: 2, repeat: Infinity }}
                                    >
                                      ✨ New
                                    </motion.span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Typography as="p" variant="body-sm" className="!text-white mb-3 line-clamp-4">
                              {message.message}
                            </Typography>
                            <div className="flex items-center justify-between">
                              <Typography as="span" variant="body-sm" className="!text-white text-xs">
                                {new Date(message.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Typography>
                              {hotPosts.length > 1 && (
                                <div className="flex gap-1">
                                  {hotPosts.slice(0, 3).map((_, idx) => (
                                    <div
                                      key={idx}
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        idx === hotPostIndex ? 'bg-orange-400' : 'bg-white/20'
                                      }`}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* All Hot Posts List */}
                  <div className="mt-4 space-y-2">
                    {hotPosts.map((message, idx) => (
                      <motion.button
                        key={message.id}
                        onClick={() => {
                          setHotPostIndex(idx);
                          setTimeout(() => setSelectedMessage(message), 300);
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          idx === hotPostIndex
                            ? 'bg-orange-500/10 border-orange-500/30'
                            : 'bg-white/[0.03] border-white/[0.05] hover:border-white/[0.1]'
                        }`}
                        whileHover={{ x: 4 }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-bold text-sm">{message.reaction_count}</span>
                          <Typography as="span" variant="body-sm" className="!text-white text-xs line-clamp-1 flex-1">
                            {message.message}
                          </Typography>
                        </div>
                        <Typography as="span" variant="body-sm" className="!text-white text-xs">
                          {new Date(message.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Typography>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Main Feed */}
            <div className={hotPosts.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <div className="flex items-center justify-between mb-4">
                    <Typography as="h2" variant="title-sm" className="!text-white font-bold">
                      All Messages
                  <span className="ml-2 text-white text-sm font-normal">
                    ({regularMessages.length})
                  </span>
                </Typography>
                {regularMessages.length > MESSAGES_PER_PAGE && (
                  <Typography as="span" variant="body-sm" className="!text-white">
                    Page {currentPage} of {totalPages}
                  </Typography>
                )}
              </div>

              <motion.div 
                className="space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {paginatedMessages.map((message, index) => {
                  const messageAge = Date.now() - new Date(message.created_at).getTime();
                  const isNew = messageAge < 24 * 60 * 60 * 1000;
                  const isExpanded = expandedCards.has(message.id);
                  const replies = Array.isArray(message.replies) ? message.replies : [];
                  const publicReply = replies.find(r => r.is_public);
                  const hasPublicReply = Boolean(publicReply);

                  return (
                    <motion.div
                      key={message.id}
                      className="bg-white/[0.03] rounded-xl border border-white/[0.05] hover:border-white/[0.08] transition-all"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.01, y: -2 }}
                    >
                      {/* Collapsed View */}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 bg-white/[0.08] text-white text-xs rounded-md border border-white/[0.1]">
                              {getTagLabel(message.tag)}
                            </span>
                            {isNew && (
                              <motion.span 
                                className="px-2 py-0.5 bg-purple-500/30 text-white text-xs font-semibold rounded-md border border-white"
                                animate={{ opacity: [1, 0.7, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              >
                                ✨ New
                              </motion.span>
                            )}
                            {hasPublicReply && (
                              <span className="px-2 py-0.5 bg-white/[0.08] text-white text-xs font-semibold rounded-md border border-white/[0.1]">
                                💬 Replied
                              </span>
                            )}
                          </div>
                          
                          <Typography as="span" variant="body-sm" className="!text-white text-xs whitespace-nowrap ml-3">
                            {new Date(message.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Typography>
                        </div>

                        {/* Message Preview */}
                        <Typography 
                          as="p" 
                          variant="body-sm" 
                          className={`!text-white mb-3 ${!isExpanded ? 'line-clamp-2' : 'whitespace-pre-wrap'}`}
                        >
                          {message.message}
                        </Typography>

                        {/* Quick Reactions Preview (always visible) */}
                        <div className="mb-3">
                          <EmojiReactions messageId={message.id} compact={true} />
                        </div>

                        {/* Expand Button */}
                        <motion.button
                          onClick={() => toggleCardExpansion(message.id)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="text-white hover:text-blue-300 text-sm font-medium flex items-center gap-1 transition-colors"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp size={16} />
                              Collapse
                            </>
                          ) : (
                            <>
                              <ChevronDown size={16} />
                              Expand
                            </>
                          )}
                        </motion.button>
                      </div>

                      {/* Expanded Content */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div 
                            className="px-4 pb-4 pt-0 border-t border-white/[0.05]"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            {/* Public Reply */}
                            {hasPublicReply && (
                              <motion.div 
                                className="mt-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                <Typography as="span" variant="body-sm" className="!text-white font-semibold text-xs">
                                  Creator's Reply
                                </Typography>
                                  <span className="px-2 py-0.5 text-xs rounded-md bg-white/[0.08] text-white border border-white/[0.1]">
                                    👁️ Public
                                  </span>
                                </div>
                                <Typography as="p" variant="body-sm" className="!text-white">
                                  {publicReply?.reply_text}
                                </Typography>
                              </motion.div>
                            )}

                            {/* Full Reactions */}
                            <motion.div 
                              className="mt-4 pt-4 border-t border-white/[0.05]"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.2 }}
                            >
                            <Typography as="p" variant="body-sm" className="!text-white mb-3 font-semibold text-xs">
                              Reactions
                            </Typography>
                              <EmojiReactions messageId={message.id} />
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Pagination */}
              {totalPages > 1 && (
                <motion.div 
                  className="flex items-center justify-between mt-6 pt-6 border-t border-white/[0.05]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Typography as="span" variant="body-sm" className="!text-white">
                    Showing {((currentPage - 1) * MESSAGES_PER_PAGE) + 1} to {Math.min(currentPage * MESSAGES_PER_PAGE, regularMessages.length)} of {regularMessages.length} messages
                  </Typography>
                  
                  <div className="flex items-center gap-2">
                    <motion.button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition-all text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </motion.button>
                    
                    <Typography as="span" variant="body-sm" className="!text-white min-w-[80px] text-center">
                      {currentPage} / {totalPages}
                    </Typography>
                    
                    <motion.button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition-all text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating "Share a Thought" Button */}
      <motion.button
        onClick={() => setShowMessageForm(true)}
        className="fixed bottom-24 right-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full px-6 py-4 shadow-2xl flex items-center gap-2 z-40"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{ 
          boxShadow: ['0 0 20px rgba(59, 130, 246, 0.5)', '0 0 40px rgba(147, 51, 234, 0.5)', '0 0 20px rgba(59, 130, 246, 0.5)'],
        }}
        transition={{ 
          boxShadow: { duration: 3, repeat: Infinity },
          scale: { duration: 0.2 }
        }}
      >
        <Plus className="w-6 h-6" />
        <span className="font-semibold whitespace-nowrap">
          Share a Thought
        </span>
      </motion.button>

      {/* Message Form Modal */}
      <AnimatePresence>
        {showMessageForm && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMessageForm(false)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
            >
              <div className="bg-[#0A0A0A] border border-white/[0.1] rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <Typography as="h2" variant="title-sm" className="!text-white font-bold">
                    Share Your Thoughts
                  </Typography>
                  <motion.button
                    onClick={() => setShowMessageForm(false)}
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    className="text-white hover:text-blue-300 transition-colors"
                  >
                    <Plus className="w-6 h-6 rotate-45" />
                  </motion.button>
                </div>
                <MessageForm 
                  creatorId={creatorId} 
                  creatorName={creatorName}
                  onSuccess={() => {
                    setShowMessageForm(false);
                    fetchMessages();
                  }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Message Modal */}
      {selectedMessage && (
        <MessageModal
          message={{
            ...selectedMessage,
            reply: selectedMessage.replies
          }}
          isOpen={!!selectedMessage}
          onClose={() => setSelectedMessage(null)}
        />
      )}
    </div>
  );
}

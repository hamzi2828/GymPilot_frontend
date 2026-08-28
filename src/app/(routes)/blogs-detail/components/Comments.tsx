"use client";

import React, { useState } from "react";
import Image from "next/image";

interface Comment {
  id: string;
  author: {
    name: string;
    avatar: string;
  };
  content: string;
  timestamp: string;
  likes: number;
  replies?: Comment[];
}

interface CommentsProps {
  comments?: Comment[];
  totalComments?: number;
}

const Comments: React.FC<CommentsProps> = ({
  comments = [],
  totalComments = 0
}) => {
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const defaultComments: Comment[] = [
    {
      id: "1",
      author: {
        name: "Sarah Mitchell",
        avatar: "/images/user-sarah.svg"
      },
      content: "This workout routine has been a game-changer for me! I've been following it for 3 months now and the results are incredible. Thank you for the detailed breakdown!",
      timestamp: "2 hours ago",
      likes: 12,
      replies: [
        {
          id: "1-1",
          author: {
            name: "Alex Johnson",
            avatar: "/images/trainer-alex.svg"
          },
          content: "So glad to hear it's working for you, Sarah! Keep up the great work 💪",
          timestamp: "1 hour ago",
          likes: 5
        }
      ]
    },
    {
      id: "2",
      author: {
        name: "Mike Rodriguez",
        avatar: "/images/user-mike.svg"
      },
      content: "Quick question about the deadlift form - should I focus more on squeezing my glutes at the top or is that happening naturally if I'm doing it right?",
      timestamp: "5 hours ago",
      likes: 8,
      replies: [
        {
          id: "2-1",
          author: {
            name: "Alex Johnson",
            avatar: "/images/trainer-alex.svg"
          },
          content: "Great question, Mike! Yes, focus on that glute squeeze at the top - it ensures you're fully engaging the posterior chain and completing the hip extension properly.",
          timestamp: "4 hours ago",
          likes: 15
        }
      ]
    },
    {
      id: "3",
      author: {
        name: "Emma Thompson",
        avatar: "/images/user-emma.svg"
      },
      content: "As a beginner, I really appreciate how you've explained each exercise step by step. The pro tips are especially helpful!",
      timestamp: "1 day ago",
      likes: 20
    }
  ];

  const displayComments = comments.length > 0 ? comments : defaultComments;
  const displayTotal = totalComments > 0 ? totalComments : displayComments.length;

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      // Handle comment submission
      console.log("New comment:", newComment);
      setNewComment("");
    }
  };

  const handleSubmitReply = (e: React.FormEvent, commentId: string) => {
    e.preventDefault();
    if (replyContent.trim()) {
      // Handle reply submission
      console.log("Reply to:", commentId, "Content:", replyContent);
      setReplyContent("");
      setReplyingTo(null);
    }
  };

  const formatTimeAgo = (timestamp: string): string => {
    // Simple timestamp formatting - in real implementation, you'd use a proper date library
    return timestamp;
  };

  return (
    <section className="gym-blog-custom-bg-darker rounded-2xl p-8">
      <div className="mb-8">
        <h3 className="font-montserrat font-bold text-2xl text-white mb-2">
          Comments ({displayTotal})
        </h3>
        <p className="text-gray-400">
          Share your thoughts and experiences with the community
        </p>
      </div>

      {/* Comment Form */}
      <form onSubmit={handleSubmitComment} className="mb-8">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
              <i className="fas fa-user text-gray-400"></i>
            </div>
          </div>
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your thoughts on this workout..."
              rows={4}
              className="w-full px-4 py-3 gym-blog-custom-bg-dark text-white rounded-lg border border-gray-600 focus:border-gym-green focus:outline-none resize-none"
            />
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <button
                  type="button"
                  className="flex items-center gap-2 hover:text-gym-green transition-colors"
                >
                  <i className="fas fa-bold"></i>
                  Bold
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 hover:text-gym-green transition-colors"
                >
                  <i className="fas fa-italic"></i>
                  Italic
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 hover:text-gym-green transition-colors"
                >
                  <i className="fas fa-link"></i>
                  Link
                </button>
              </div>
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="gym-blog-custom-bg-green text-black px-6 py-2 rounded-lg font-semibold hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Post Comment
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-6">
        {displayComments.map((comment) => (
          <div key={comment.id} className="border-b border-gray-700 pb-6 last:border-b-0">
            {/* Main Comment */}
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="relative w-12 h-12">
                  <Image
                    src={comment.author.avatar}
                    alt={comment.author.name}
                    fill
                    className="rounded-full object-cover"
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-semibold text-white">
                    {comment.author.name}
                  </h4>
                  <span className="text-sm text-gray-400">
                    {formatTimeAgo(comment.timestamp)}
                  </span>
                </div>
                <p className="text-gray-300 mb-3 leading-relaxed">
                  {comment.content}
                </p>
                <div className="flex items-center gap-6">
                  <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-gym-green transition-colors">
                    <i className="far fa-thumbs-up"></i>
                    {comment.likes}
                  </button>
                  <button
                    onClick={() => setReplyingTo(comment.id)}
                    className="text-sm text-gray-400 hover:text-gym-green transition-colors"
                  >
                    Reply
                  </button>
                  <button className="text-sm text-gray-400 hover:text-red-400 transition-colors">
                    Report
                  </button>
                </div>

                {/* Reply Form */}
                {replyingTo === comment.id && (
                  <form onSubmit={(e) => handleSubmitReply(e, comment.id)} className="mt-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                          <i className="fas fa-user text-gray-400 text-xs"></i>
                        </div>
                      </div>
                      <div className="flex-1">
                        <textarea
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          placeholder={`Reply to ${comment.author.name}...`}
                          rows={3}
                          className="w-full px-3 py-2 gym-blog-custom-bg-dark text-white rounded-lg border border-gray-600 focus:border-gym-green focus:outline-none resize-none text-sm"
                        />
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            type="submit"
                            disabled={!replyContent.trim()}
                            className="gym-blog-custom-bg-green text-black px-4 py-1 rounded text-sm font-semibold hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                          >
                            Reply
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyContent("");
                            }}
                            className="text-sm text-gray-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                )}

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-4 pl-4 border-l-2 border-gray-700 space-y-4">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="flex gap-3">
                        <div className="flex-shrink-0">
                          <div className="relative w-8 h-8">
                            <Image
                              src={reply.author.avatar}
                              alt={reply.author.name}
                              fill
                              className="rounded-full object-cover"
                            />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-semibold text-white text-sm">
                              {reply.author.name}
                            </h5>
                            <span className="text-xs text-gray-400">
                              {formatTimeAgo(reply.timestamp)}
                            </span>
                          </div>
                          <p className="text-gray-300 text-sm mb-2">
                            {reply.content}
                          </p>
                          <div className="flex items-center gap-4">
                            <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-gym-green transition-colors">
                              <i className="far fa-thumbs-up"></i>
                              {reply.likes}
                            </button>
                            <button className="text-xs text-gray-400 hover:text-gym-green transition-colors">
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More Comments */}
      {displayTotal > displayComments.length && (
        <div className="text-center mt-8">
          <button className="gym-blog-custom-bg-dark text-white px-6 py-3 rounded-lg font-semibold hover:gym-blog-custom-bg-darker transition-colors">
            Load More Comments
          </button>
        </div>
      )}
    </section>
  );
};

export default Comments;
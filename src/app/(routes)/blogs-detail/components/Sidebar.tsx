"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Author, blogDetailService, type BlogDetailData } from "../services/blogDetailService";
import Newsletter from "./Newsletter";

interface TableOfContentsItem {
  id: string;
  title: string;
  level: number;
}

interface RelatedArticle {
  id: string;
  title: string;
  slug: string;
  thumbnail: string;
  readingTime: string;
  views: number;
}

interface SidebarProps {
  author?: Author;
  categoryId?: string;
  currentBlogId?: string;
  categoryName?: string;
  tableOfContents?: TableOfContentsItem[];
  relatedArticles?: RelatedArticle[];
}

const Sidebar: React.FC<SidebarProps> = ({
  author,
  categoryId,
  currentBlogId,
  categoryName,
  relatedArticles = []
}) => {
  const [dynamicRelatedArticles, setDynamicRelatedArticles] = useState<BlogDetailData[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [shareNote, setShareNote] = useState("");

  useEffect(() => {
    const fetchRelatedArticles = async () => {
      if (!categoryId || !currentBlogId) {
        return;
      }

      try {
        setIsLoadingRelated(true);
        const related = await blogDetailService.getRelatedArticles(categoryId, currentBlogId, 6);
        setDynamicRelatedArticles(related);
      } catch (error) {
        console.error('Error fetching related articles for sidebar:', error);
        setDynamicRelatedArticles([]);
      } finally {
        setIsLoadingRelated(false);
      }
    };

    fetchRelatedArticles();
  }, [categoryId, currentBlogId]);

  // Only the post's real author and real related posts are shown. This used
  // to fall back to an invented trainer ("Alex Johnson"), social links that
  // went nowhere and three made-up articles -- on every gym's site.

  // Convert BlogDetailData to RelatedArticle format for display
  const convertedDynamicArticles: RelatedArticle[] = dynamicRelatedArticles.map((article) => ({
    id: article._id,
    title: article.title,
    slug: article.slug,
    thumbnail: article.thumbnail || article.image || '/images/gym-blog-1.svg',
    readingTime: blogDetailService.estimateReadingTime(article.content),
    views: article.views || 0
  }));

  // Use dynamic related articles if available, otherwise whatever was passed in
  const displayRelatedArticles = convertedDynamicArticles.length > 0
    ? convertedDynamicArticles
    : relatedArticles;

  const shareArticle = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareNote("Link copied");
        setTimeout(() => setShareNote(""), 2500);
      }
    } catch {
      // Closing the share sheet counts as an error; nothing to report.
    }
  };

  return (
    <aside className="space-y-8">
      {/* Author Info -- only when the post has an author on file */}
      {author && (
      <div className="gym-blog-custom-bg-darker rounded-2xl p-6">
        <h3 className="font-montserrat font-bold text-xl mb-4 text-white">
          About the Author
        </h3>
        <div className="flex flex-col items-center text-center">
          <div className="relative w-20 h-20 mb-4">
            <Image
              src={author.avatarUrl || author.avatar || "/images/default-avatar.svg"}
              alt={author.name}
              fill
              className="rounded-full object-cover border-2 border-green-500"
            />
          </div>
          <h4 className="font-bold text-lg text-white mb-2">
            {author.name}
          </h4>

          {/* Author Stats */}
          <div className="flex gap-4 mb-3">
            <div className="text-center">
              <div className="font-bold text-green-500">
                {author.blogCount || 0}
              </div>
              <div className="text-xs text-gray-400">Articles</div>
            </div>
            {author.createdAt && (
              <div className="text-center">
                <div className="font-bold text-green-500">
                  {new Date(author.createdAt).getFullYear()}
                </div>
                <div className="text-xs text-gray-400">Joined</div>
              </div>
            )}
          </div>

          {author.bio && (
            <p className="text-gray-300 text-sm mb-4 leading-relaxed">
              {author.bio}
            </p>
          )}

          {/* Contact Author Button */}
          {author.email && (
            <a
              href={`mailto:${author.email}`}
              className="w-full mb-4 gym-blog-custom-bg-green text-black py-2 px-4 rounded-lg font-semibold hover:scale-105 transition-all duration-300 text-sm"
            >
              Contact Author
            </a>
          )}
        </div>
      </div>
      )}

      {/* Newsletter Signup. `source` must be one the API accepts
          (blog, homepage, sidebar, footer) or the subscribe fails. */}
      <Newsletter
        source="sidebar"
        title="Stay Updated"
        description="Get the latest fitness tips and workout routines delivered to your inbox."
      />

      {/* Related Articles */}
      <div className="gym-blog-custom-bg-darker rounded-2xl p-6">
        <h3 className="font-montserrat font-bold text-xl mb-4 text-white">
          {categoryName ? `More from ${categoryName}` : 'Related Articles'}
        </h3>

        {/* Loading State */}
        {isLoadingRelated && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
          </div>
        )}

        {/* Articles List */}
        {!isLoadingRelated && (
          <div className="space-y-4">
            {displayRelatedArticles.slice(0, 6).map((article) => (
              <Link href={`/blogs-detail?slug=${article.slug}`} key={article.id} className="block group">
                <article className="flex gap-4 p-3 rounded-lg hover:gym-blog-custom-bg-dark transition-colors">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <Image
                      src={article.thumbnail}
                      alt={article.title}
                      fill
                      className="object-cover rounded-lg"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-white mb-1 line-clamp-2 group-hover:gym-blog-custom-text-green transition-colors">
                      {article.title}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{article.readingTime}</span>
                      <span>{article.views} views</span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        {/* No Articles Found */}
        {!isLoadingRelated && displayRelatedArticles.length === 0 && (
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm">No related articles found.</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="gym-blog-custom-bg-darker rounded-2xl p-6">
        <h3 className="font-montserrat font-bold text-xl mb-4 text-white">
          Quick Actions
        </h3>
        <div className="space-y-3">
          <button type="button" onClick={shareArticle} className="w-full flex items-center justify-center gap-2 py-3 border border-gray-600 text-gray-300 rounded-lg hover:border-gym-green hover:text-gym-green transition-colors">
            <i className="fas fa-share-alt"></i>
            {shareNote || "Share Article"}
          </button>
          <button type="button" onClick={() => window.print()} className="w-full flex items-center justify-center gap-2 py-3 border border-gray-600 text-gray-300 rounded-lg hover:border-gym-green hover:text-gym-green transition-colors">
            <i className="fas fa-print"></i>
            Print Article
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
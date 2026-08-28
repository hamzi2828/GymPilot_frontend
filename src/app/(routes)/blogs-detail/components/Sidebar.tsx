"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Author, blogDetailService, type BlogDetailData } from "../services/blogDetailService";
import Newsletter from "./Newsletter";

interface SidebarAuthor {
  name: string;
  avatar?: string;
  bio?: string;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
  };
}

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

  const defaultAuthor: SidebarAuthor = {
    name: "Alex Johnson",
    avatar: "/images/trainer-alex.svg",
    bio: "Certified personal trainer with 8+ years of experience helping clients achieve their fitness goals through science-based training methods.",
    socialLinks: {
      twitter: "#",
      instagram: "#",
      youtube: "#"
    }
  };

  const defaultRelatedArticles: RelatedArticle[] = [
    {
      id: "1",
      title: "5 Essential Warm-Up Exercises",
      slug: "essential-warm-up-exercises",
      thumbnail: "/images/gym-blog-1.svg",
      readingTime: "5 min read",
      views: 892
    },
    {
      id: "2",
      title: "Nutrition for Strength Training",
      slug: "nutrition-strength-training",
      thumbnail: "/images/gym-blog-2.svg",
      readingTime: "8 min read",
      views: 1456
    },
    {
      id: "3",
      title: "Recovery and Rest Days",
      slug: "recovery-rest-days",
      thumbnail: "/images/gym-blog-3.svg",
      readingTime: "6 min read",
      views: 743
    }
  ];

  // Convert Author to SidebarAuthor format
  const convertedAuthor: SidebarAuthor = author ? {
    name: author.name,
    avatar: author.avatarUrl || author.avatar,
    bio: author.bio || `${author.name} is a fitness expert and content creator.`,
    socialLinks: {
      twitter: "#",
      instagram: "#",
      youtube: "#"
    }
  } : defaultAuthor;

  const displayAuthor = convertedAuthor;

  // Convert BlogDetailData to RelatedArticle format for display
  const convertedDynamicArticles: RelatedArticle[] = dynamicRelatedArticles.map((article) => ({
    id: article._id,
    title: article.title,
    slug: article.slug,
    thumbnail: article.thumbnail || article.image || '/images/gym-blog-1.svg',
    readingTime: blogDetailService.estimateReadingTime(article.content),
    views: article.views || 0
  }));

  // Use dynamic related articles if available, otherwise fall back to provided or default
  const displayRelatedArticles = convertedDynamicArticles.length > 0
    ? convertedDynamicArticles
    : (relatedArticles.length > 0 ? relatedArticles : defaultRelatedArticles);


  return (
    <aside className="space-y-8">
      {/* Author Info */}
      <div className="gym-blog-custom-bg-darker rounded-2xl p-6">
        <h3 className="font-montserrat font-bold text-xl mb-4 text-white">
          About the Author
        </h3>
        <div className="flex flex-col items-center text-center">
          <div className="relative w-20 h-20 mb-4">
            <Image
              src={displayAuthor.avatar || "/images/default-avatar.svg"}
              alt={displayAuthor.name}
              fill
              className="rounded-full object-cover border-2 border-green-500"
            />
          </div>
          <h4 className="font-bold text-lg text-white mb-2">
            {displayAuthor.name}
          </h4>

          {/* Author Stats */}
          {author && (
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
          )}

          <p className="text-gray-300 text-sm mb-4 leading-relaxed">
            {displayAuthor.bio}
          </p>

          {/* Contact Author Button */}
          {author?.email && (
            <a
              href={`mailto:${author.email}`}
              className="w-full mb-4 gym-blog-custom-bg-green text-black py-2 px-4 rounded-lg font-semibold hover:scale-105 transition-all duration-300 text-sm"
            >
              Contact Author
            </a>
          )}

          {displayAuthor.socialLinks && (
            <div className="flex gap-3">
              {displayAuthor.socialLinks.twitter && (
                <a
                  href={displayAuthor.socialLinks.twitter}
                  className="w-8 h-8 bg-blue-400 text-white rounded-full flex items-center justify-center hover:bg-blue-500 transition-colors"
                >
                  <i className="fab fa-twitter text-sm"></i>
                </a>
              )}
              {displayAuthor.socialLinks.instagram && (
                <a
                  href={displayAuthor.socialLinks.instagram}
                  className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full flex items-center justify-center hover:from-purple-600 hover:to-pink-600 transition-colors"
                >
                  <i className="fab fa-instagram text-sm"></i>
                </a>
              )}
              {displayAuthor.socialLinks.youtube && (
                <a
                  href={displayAuthor.socialLinks.youtube}
                  className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 transition-colors"
                >
                  <i className="fab fa-youtube text-sm"></i>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Newsletter Signup */}
      <Newsletter
        source="blog-sidebar"
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
          <button className="w-full flex items-center justify-center gap-2 py-3 border border-gray-600 text-gray-300 rounded-lg hover:border-gym-green hover:text-gym-green transition-colors">
            <i className="far fa-bookmark"></i>
            Save Article
          </button>
          <button className="w-full flex items-center justify-center gap-2 py-3 border border-gray-600 text-gray-300 rounded-lg hover:border-gym-green hover:text-gym-green transition-colors">
            <i className="fas fa-share-alt"></i>
            Share Article
          </button>
          <button className="w-full flex items-center justify-center gap-2 py-3 border border-gray-600 text-gray-300 rounded-lg hover:border-gym-green hover:text-gym-green transition-colors">
            <i className="fas fa-print"></i>
            Print Article
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
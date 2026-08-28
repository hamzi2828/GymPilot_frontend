"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { blogDetailService, type BlogDetailData } from "../services/blogDetailService";
import Newsletter from "./Newsletter";

interface RelatedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  thumbnail: string;
  category: string;
  readingTime: string;
  publishDate: string;
  author: {
    name: string;
    avatar: string;
  };
  views: number;
}

interface RelatedArticlesProps {
  articles?: RelatedArticle[];
  currentArticleId?: string;
  categoryId?: string;
  categoryName?: string;
}

const RelatedArticles: React.FC<RelatedArticlesProps> = ({
  currentArticleId,
  categoryId,
  categoryName
}) => {
  const [relatedArticles, setRelatedArticles] = useState<BlogDetailData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchRelatedArticles = async () => {
      if (!categoryId || !currentArticleId) {
        return;
      }

      try {
        setIsLoading(true);
        const related = await blogDetailService.getRelatedArticles(categoryId, currentArticleId, 6);
        setRelatedArticles(related);
      } catch (error) {
        console.error('Error fetching related articles:', error);
        setRelatedArticles([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRelatedArticles();
  }, [categoryId, currentArticleId]);

  // Use real data from API
  const displayArticles = relatedArticles;

  // Convert BlogDetailData to RelatedArticle format for display
  const convertedArticles = displayArticles.map((article) => ({
    id: article._id,
    title: article.title,
    slug: article.slug,
    excerpt: article.content?.replace(/<[^>]*>/g, '').substring(0, 150) + '...' || '',
    thumbnail: article.thumbnail || article.image || '/images/gym-blog-1.svg',
    category: article.categoryId?.name || categoryName || 'Article',
    readingTime: blogDetailService.estimateReadingTime(article.content),
    publishDate: blogDetailService.formatPublishDate(article.createdAt),
    author: {
      name: article.author?.name || 'Unknown',
      avatar: article.author?.avatarUrl || article.author?.avatar || '/images/gym-1.svg'
    },
    views: article.views || 0
  }));

  // Filter out current article if provided
  const filteredArticles = currentArticleId
    ? convertedArticles.filter(article => article.id !== currentArticleId)
    : convertedArticles;

  const getCategoryColor = (category: string): string => {
    const colors: { [key: string]: string } = {
      'Nutrition': 'bg-green-500',
      'Recovery': 'bg-blue-500',
      'Mindset': 'bg-purple-500',
      'Training': 'bg-red-500',
      'Strength': 'bg-orange-500',
      'Cardio': 'bg-pink-500',
      'default': 'bg-gray-500'
    };
    return colors[category] || colors.default;
  };

  const formatTimeAgo = (dateString: string): string => {
    // Simple date formatting - in real implementation, you'd use a proper date library
    return dateString;
  };

  return (
    <section className="py-16 gym-blog-custom-bg-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-montserrat font-bold text-3xl sm:text-4xl text-white mb-4">
            {categoryName ? `More from ${categoryName}` : 'Related Articles'}
          </h2>
          <div className="w-24 h-1 gym-blog-custom-bg-green mx-auto mb-6"></div>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            {categoryName
              ? `Explore more articles in the ${categoryName} category`
              : 'Continue your fitness journey with these hand-picked articles'
            }
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
          </div>
        )}

        {/* No Related Articles */}
        {!isLoading && filteredArticles.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-300">No related articles found.</p>
          </div>
        )}

        {/* Related Articles Grid */}
        {!isLoading && filteredArticles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredArticles.slice(0, 6).map((article) => (
            <Link href={`/blogs-detail?slug=${article.slug}`} key={article.id} className="block group">
              <article className="gym-blog-custom-bg-darker rounded-2xl overflow-hidden gym-blog-hover-lift transition-all duration-500 h-full">
                <div className="relative h-48 overflow-hidden">
                  <Image
                    src={article.thumbnail}
                    alt={article.title}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute top-4 left-4">
                    <span className={`${getCategoryColor(article.category)} text-white px-3 py-1 rounded-full text-xs font-bold uppercase`}>
                      {article.category}
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <button className="w-8 h-8 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 transition-colors">
                      <i className="far fa-bookmark text-sm"></i>
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-bold text-lg text-white mb-3 line-clamp-2 group-hover:gym-blog-custom-text-green transition-colors">
                    {article.title}
                  </h3>

                  <p className="text-gray-400 text-sm mb-4 line-clamp-3 leading-relaxed">
                    {article.excerpt}
                  </p>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative w-8 h-8">
                      <Image
                        src={article.author.avatar}
                        alt={article.author.name}
                        fill
                        className="rounded-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {article.author.name}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {formatTimeAgo(article.publishDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-4 border-t border-gray-700">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <i className="far fa-clock"></i>
                        {article.readingTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="far fa-eye"></i>
                        {article.views.toLocaleString()}
                      </span>
                    </div>
                    <i className="fas fa-arrow-up-right gym-blog-custom-text-green group-hover:transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"></i>
                  </div>
                </div>
              </article>
            </Link>
            ))}
          </div>
        )}

        {/* View All Articles Button */}
        <div className="text-center mt-12">
          <Link
            href="/blogs"
            className="gym-blog-custom-bg-green text-black px-8 py-4 rounded-full font-bold hover:scale-105 transition-all duration-300 inline-flex items-center gap-2"
          >
            View All Articles <i className="fas fa-arrow-right"></i>
          </Link>
        </div>

        {/* Newsletter Signup Section */}
        <Newsletter
          source="blog"
          className="mt-16"
        />
      </div>
    </section>
  );
};

export default RelatedArticles;
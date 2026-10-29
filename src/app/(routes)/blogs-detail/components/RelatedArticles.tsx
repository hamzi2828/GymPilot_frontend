"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { blogDetailService, type BlogDetailData } from "../services/blogDetailService";
import Newsletter from "./Newsletter";
import BlogCard from "../../blogs/components/BlogCard";
import Reveal from "@/components/site/Reveal";
import { SectionHeading, surfaceClass } from "@/components/site/PageHero";

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
    thumbnail: article.thumbnail || article.image || '/images/class-placeholder.svg',
    category: article.categoryId?.name || categoryName || 'Article',
    readingTime: blogDetailService.estimateReadingTime(article.content),
    publishDate: blogDetailService.formatPublishDate(article.createdAt),
    author: {
      name: article.author?.name || 'Unknown',
      avatar: article.author?.avatarUrl || article.author?.avatar || '/images/default-avatar.svg'
    },
    views: article.views || 0
  }));

  // Filter out current article if provided
  const filteredArticles = currentArticleId
    ? convertedArticles.filter(article => article.id !== currentArticleId)
    : convertedArticles;

  return (
    <section className={`${surfaceClass} px-4 py-20 sm:px-8 lg:px-20`} aria-labelledby="related-title">
      <div className="relative mx-auto max-w-7xl">
        <SectionHeading
          id="related-title"
          eyebrow="Keep reading"
          title={categoryName ? `More from ${categoryName}` : "Related articles"}
          center
        />

        {isLoading && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading articles">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-80 rounded-3xl bg-[var(--surface)] animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && filteredArticles.length === 0 && (
          <p className="py-8 text-center text-[var(--text-muted)]">No related articles found.</p>
        )}

        {!isLoading && filteredArticles.length > 0 && (
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredArticles.slice(0, 6).map((article, i) => (
              <Reveal as="li" key={article.id} delay={(i % 3) * 0.08}>
                <BlogCard
                  href={`/blogs-detail?slug=${article.slug}`}
                  image={article.thumbnail}
                  title={article.title}
                  excerpt={article.excerpt}
                  category={article.category}
                  metaLeft={article.author.name !== "Unknown" ? `${article.author.name} · ${article.publishDate}` : article.publishDate}
                  metaRight={article.readingTime}
                />
              </Reveal>
            ))}
          </ul>
        )}

        <div className="mt-12 text-center">
          <Link href="/blogs" className="btn btn--primary btn--lg">
            <span>View All Articles</span>
            <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </div>

        {/* Newsletter Signup Section */}
        <Newsletter source="blog" className="mt-16" />
      </div>
    </section>
  );
};

export default RelatedArticles;
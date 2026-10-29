"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import HeroSection from "./components/HeroSection";
import MainContent from "./components/MainContent";
import Sidebar from "./components/Sidebar";
import RelatedArticles from "./components/RelatedArticles";
import { blogDetailService, type BlogDetailData } from "./services/blogDetailService";

const BlogDetailContent = () => {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug');

  const [blogData, setBlogData] = useState<BlogDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBlogData = async () => {
      if (!slug) {
        setError('Blog slug not provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await blogDetailService.getBlogBySlug(slug);
        setBlogData(data);
      } catch (error) {
        console.error('Error fetching blog:', error);
        setError('Failed to fetch blog data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBlogData();
  }, [slug]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--base)] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)] mx-auto mb-4"></div>
          <p className="text-gray-300">Loading blog...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !blogData) {
    return (
      <div className="min-h-screen bg-[var(--base)] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Blog Not Found</h1>
          <p className="text-gray-300 mb-4">{error || 'The requested blog could not be found.'}</p>
          <a href="/blogs" className="btn btn--primary">
            <span>Back to Blogs</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--base)] text-white">
      {/* Hero Section */}
      <HeroSection
        title={blogData.title}
        backgroundImage={blogData.image || undefined}
        category={blogData.categoryId || { name: "Article" }}
        // No author on file shows no byline, rather than "By Unknown". The
        // resolved avatarUrl, not the raw /uploads path, which lives on the API.
        author={
          blogData.author
            ? { name: blogData.author.name, avatar: blogData.author.avatarUrl || blogData.author.avatar }
            : undefined
        }
        readingTime={blogDetailService.estimateReadingTime(blogData.content)}
        publishDate={blogDetailService.formatPublishDate(blogData.createdAt)}
        views={blogData.views}
      />

      {/* Main Content Section */}
      <section id="article" className="scroll-mt-20 px-4 sm:px-6 lg:px-20 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto">
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-4 gap-12">
            {/* Article Content */}
            <div className="min-w-0 lg:col-span-3">
              <MainContent content={blogData.content} />
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <Sidebar
                author={blogData.author}
                categoryId={blogData.categoryId?._id}
                currentBlogId={blogData._id}
                categoryName={blogData.categoryId?.name}
              />
            </div>
          </div>
        </div>
      </section>

 

      {/* Related Articles */}
      <RelatedArticles
        currentArticleId={blogData._id}
        categoryId={blogData.categoryId?._id}
        categoryName={blogData.categoryId?.name}
      />
    </main>
  );
};

const BlogDetailPage = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--base)] text-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)] mx-auto mb-4"></div>
            <p className="text-gray-300">Loading blog...</p>
          </div>
        </div>
      }
    >
      <BlogDetailContent />
    </Suspense>
  );
};

export default BlogDetailPage;
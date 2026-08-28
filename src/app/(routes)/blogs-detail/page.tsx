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
      <div className="min-h-screen gym-blog-custom-bg-dark text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading blog...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !blogData) {
    return (
      <div className="min-h-screen gym-blog-custom-bg-dark text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Blog Not Found</h1>
          <p className="text-gray-300 mb-4">{error || 'The requested blog could not be found.'}</p>
          <a href="/blogs" className="gym-blog-custom-gradient-green text-black font-bold px-6 py-3 rounded-full hover:scale-105 transition-all duration-300">
            Back to Blogs
          </a>
        </div>
      </div>
    );
  }



  const workoutOverview = {
    duration: "60-75 minutes",
    difficulty: "Intermediate",
    equipment: "Barbell, Dumbbells, Cable Machine",
    targetMuscles: ["Chest", "Shoulders", "Triceps"]
  };

  // const exercises = [
  //   {
  //     name: "Barbell Bench Press",
  //     image: "/images/gym-2.svg",
  //     sets: "4 sets",
  //     reps: "6-8 reps",
  //     rest: "3-4 min",
  //     tips: "Keep your feet planted, core tight, and control the descent. Drive through your feet on the press."
  //   },
  //   {
  //     name: "Overhead Press",
  //     image: "/images/gym-3.svg",
  //     sets: "4 sets",
  //     reps: "8-10 reps",
  //     rest: "2-3 min",
  //     tips: "Keep your core braced and avoid arching your back. Press the bar in a straight line overhead."
  //   },
  //   {
  //     name: "Incline Dumbbell Press",
  //     image: "/images/gym-4.svg",
  //     sets: "3 sets",
  //     reps: "10-12 reps",
  //     rest: "2-3 min",
  //     tips: "Set the bench to 30-45 degrees. Focus on squeezing your chest at the top of the movement."
  //   },
  //   {
  //     name: "Dips",
  //     image: "/images/gym-5.svg",
  //     sets: "3 sets",
  //     reps: "8-12 reps",
  //     rest: "2 min",
  //     tips: "Lean slightly forward to target the chest more. Keep your elbows close to your body."
  //   }
  // ];

  return (
    <div className="min-h-screen gym-blog-custom-bg-dark text-white">
      {/* Hero Section */}
      <HeroSection
        title={blogData.title}
        backgroundImage={blogData.image || "/images/hero.svg"}
        category={blogData.categoryId || { name: "Article" }}
        author={blogData.author || { name: "Unknown", avatar: "/images/gym-1.svg" }}
        readingTime={blogDetailService.estimateReadingTime(blogData.content)}
        publishDate={blogDetailService.formatPublishDate(blogData.createdAt)}
        views={blogData.views}
      />

      {/* Main Content Section */}
      <section className="px-4 sm:px-6 lg:px-20 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            {/* Article Content */}
            <div className="lg:col-span-3">
              <MainContent
                content={blogData.content}
                workoutOverview={workoutOverview}
              />

              {/* About the Author Section */}
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
    </div>
  );
};

const BlogDetailPage = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen gym-blog-custom-bg-dark text-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
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
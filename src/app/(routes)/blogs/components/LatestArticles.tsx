"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { blogService, type BlogData } from "../services/blogService";

const LatestArticles: React.FC = () => {
  const [blogs, setBlogs] = useState<BlogData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLatestBlogs = async () => {
      try {
        setIsLoading(true);
        const latestBlogs = await blogService.getLatestBlogs(4);
        setBlogs(latestBlogs);
      } catch (error) {
        console.error('Error fetching latest blogs:', error);
        setBlogs([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLatestBlogs();
  }, []);
  return (
    <section className="px-4 sm:px-6 lg:px-20 py-12 sm:py-16 lg:py-20 gym-blog-custom-bg-dark text-white">
      <div className="mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-16">
          <div>
            <h2 className="font-montserrat font-bold text-3xl sm:text-4xl uppercase tracking-wide mb-4">
              Latest Articles
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl">
              Fresh content from our experts and community members
            </p>
          </div>
          <a
            href="#"
            className="mt-6 lg:mt-0 gym-blog-custom-gradient-green text-black font-bold px-6 py-3 rounded-full hover:scale-105 transition-all duration-300  gap-2"
          >
            View All Articles <i className="fas fa-arrow-right"></i>
          </a>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
          </div>
        )}

        {/* Articles Grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {blogs.length > 0 ? (
              blogs.map((blog, index) => (
                <Link href={`/blogs-detail?slug=${blog.slug}`} key={blog._id} className="block">
                  <article className="gym-blog-custom-bg-darker rounded-xl overflow-hidden gym-blog-hover-lift transition-all duration-500 group">
                    <div className="relative h-40 overflow-hidden">
                      <Image
                        src={blog.thumbnail || blog.image || "/images/gym-blog-1.svg"}
                        alt={blog.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute top-3 left-3">
                        <span className={`${
                          index === 0 ? 'bg-green-500' :
                          index === 1 ? 'bg-orange-500' :
                          index === 2 ? 'bg-purple-500' :
                          'bg-red-500'
                        } text-white px-2 py-1 rounded text-xs font-bold uppercase`}>
                          {blog.categoryId?.name || 'Article'}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-sm mb-2 group-hover:gym-blog-custom-text-green transition-colors line-clamp-2">
                        {blog.title}
                      </h3>
                      <div
                        className="text-gray-400 text-sm mb-3 line-clamp-2"
                        dangerouslySetInnerHTML={{
                          __html: blog.content?.replace(/<[^>]*>/g, '').substring(0, 100) + '...'
                        }}
                      />
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{blogService.estimateReadingTime(blog.content)}</span>
                        <span>{blogService.formatTimeAgo(blog.createdAt)}</span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))
            ) : (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-300">No latest articles available.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default LatestArticles;
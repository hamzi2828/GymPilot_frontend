"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { heroSectionService, FeaturedCategoryWithBlogs } from "../services/heroSectionService";

const FeaturedStories: React.FC = () => {
  const [featuredCategories, setFeaturedCategories] = useState<FeaturedCategoryWithBlogs[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeaturedData = async () => {
      try {
        setIsLoading(true);
        const data = await heroSectionService.getFeaturedCategoriesWithSixBlogs();
        console.log('Featured Categories with 6 Blogs Each - Response:', data);
        console.log('Total Featured Categories:', data.length);
        data.forEach((category, index) => {
          console.log(`Category ${index + 1}: ${category.name} - ${category.blogs?.length || 0} blogs`);
        });
        setFeaturedCategories(data);
      } catch (error) {
        console.error('Error fetching featured categories:', error);
        setFeaturedCategories([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeaturedData();
  }, []);
  return (
    <section
      id="featured"
      className="px-4 sm:px-12 lg:px-28 py-12 sm:py-16 lg:py-20 gym-blog-custom-bg-darker text-white"
    >
      <div className="mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-montserrat font-bold text-3xl sm:text-4xl uppercase tracking-wide mb-4">
            Featured Stories
          </h2>
          <div className="w-24 h-1 gym-blog-custom-bg-green mx-auto mb-6"></div>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Inspiring transformation stories from our community members
          </p>
        </div>

        {/* Display loading state */}
        {isLoading && (
          <div className="text-center py-8">
            <p className="text-gray-300">Loading featured categories...</p>
          </div>
        )}


        {/* Display message if no data */}
        {!isLoading && featuredCategories.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-300">No featured categories available. Check console for details.</p>
          </div>
        )}

        {/* Large Featured Card - Display category banner image */}
        {!isLoading && featuredCategories.length > 0 && (
          <div className="mb-16">
            <article className="relative overflow-hidden rounded-2xl gym-blog-hover-lift transition-all duration-500 group">
              <div className="relative h-96 lg:h-[500px]">
                <Image
                  src={featuredCategories[0].bannerUrl ||
                       featuredCategories[0].thumbnailUrl ||
                       "/images/gym-large.svg"}
                  alt={featuredCategories[0].name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                  priority
                />
                <div className="gym-blog-image-overlay absolute inset-0"></div>
                <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-12">
                  <span className="gym-blog-custom-bg-green text-black px-4 py-2 rounded-full text-sm font-bold uppercase mb-4 inline-block">
                    {featuredCategories[0].name}
                  </span>
                  <h3 className="font-montserrat font-bold text-3xl lg:text-5xl mb-4 text-white">
                    {featuredCategories[0].description || featuredCategories[0].name}
                  </h3>
                  <div className="text-lg lg:text-xl text-gray-200 mb-6 max-w-3xl">
                    <p>Explore our {featuredCategories[0].name.toLowerCase()} collection with {featuredCategories[0].blogs?.length || 0} featured articles</p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 text-gray-300">
                    <div className="flex items-center gap-2">
                      <i className="far fa-folder gym-blog-custom-text-green"></i>
                      <span className="text-sm sm:text-base md:text-lg lg:text-xl">
                        {featuredCategories[0].blogs?.length || 0} Articles
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <i className="far fa-star gym-blog-custom-text-green"></i>
                      <span className="text-sm sm:text-base md:text-lg lg:text-xl">
                        Featured Category
                      </span>
                    </div>
                    <span className="gym-blog-custom-text-green font-semibold text-sm sm:text-base md:text-lg lg:text-xl">
                      Scroll down to explore <i className="fas fa-arrow-down"></i>
                    </span>
                  </div>
                </div>
              </div>
            </article>
          </div>
        )}

        {/* Featured Categories Section */}
        {!isLoading && featuredCategories.length > 0 && (
          <>
            {featuredCategories.map((category, categoryIndex) => (
              <div key={category.id} className="mb-16">
                {/* Category Banner */}
                {category.bannerUrl && (
                  <div className="mb-8">
                    <div className="relative h-48 sm:h-64 overflow-hidden rounded-xl">
                      <Image
                        src={category.bannerUrl}
                        alt={`${category.name} banner`}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-40"></div>
                      <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
                        <span className="gym-blog-custom-bg-green text-black px-4 py-2 rounded-full text-sm font-bold uppercase mb-2 inline-block">
                          Featured Category
                        </span>
                        <h3 className="font-montserrat font-bold text-2xl sm:text-3xl text-white">
                          {category.name}
                        </h3>
                        <p className="text-gray-200 text-sm sm:text-base">{category.description}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Category Header (when no banner) */}
                {!category.bannerUrl && (
                  <div className="mb-8 flex items-center gap-4">
                    {/* Category Thumbnail */}
                    {category.thumbnailUrl && (
                      <div className="flex-shrink-0">
                        <Image
                          src={category.thumbnailUrl}
                          alt={category.name}
                          width={64}
                          height={64}
                          className="rounded-full object-cover border-2 border-gray-600"
                        />
                      </div>
                    )}
                    <div>
                      <h3 className="font-montserrat font-bold text-2xl sm:text-3xl uppercase text-white mb-2">
                        {category.name}
                      </h3>
                      <p className="text-gray-300 mb-4">{category.description}</p>
                      <div className="w-16 h-1 gym-blog-custom-bg-green"></div>
                    </div>
                  </div>
                )}

                {/* Category Blogs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {category.blogs?.slice(0, 6).map((blog) => (
                    <Link href={`/blogs-detail?slug=${blog.slug}`} key={blog._id} className="block">
                      <article className="gym-blog-card-gradient rounded-xl overflow-hidden gym-blog-hover-lift transition-all duration-500 group">
                        <div className="relative h-48 overflow-hidden">
                          <Image
                            src={blog.thumbnail?.startsWith('/uploads/')
                              ? `${process.env.NEXT_PUBLIC_BACKEND_URL}${blog.thumbnail}`
                              : blog.thumbnail || "/images/gym-blog-1.svg"}
                            alt={blog.title}
                            fill
                            className="object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                          <div className="absolute top-4 left-4">
                            <span className={`${
                              categoryIndex === 0 ? 'bg-red-500' :
                              categoryIndex === 1 ? 'bg-blue-500' :
                              'bg-green-500'
                            } text-white px-3 py-1 rounded-full text-xs font-bold uppercase`}>
                              {category.name.split(' ')[0]}
                            </span>
                          </div>
                        </div>
                        <div className="p-6">
                          <h3 className="font-semibold text-xl mb-3 group-hover:gym-blog-custom-text-green transition-colors line-clamp-2">
                            {blog.title}
                          </h3>
                          <div
                            className="text-gray-400 text-sm mb-4 line-clamp-3"
                            dangerouslySetInnerHTML={{
                              __html: blog.content?.replace(/<[^>]*>/g, '').substring(0, 150) + '...'
                            }}
                          />
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              {blog.views || 0} views
                            </span>
                            <span className="text-xs text-gray-500">
                              By {blog.author?.name || 'Unknown'}
                            </span>
                            <i className="fas fa-arrow-up-right gym-blog-custom-text-green group-hover:transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"></i>
                          </div>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* Static Fallback Grid - Show when no data is available */}
        {(!isLoading && featuredCategories.length === 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Link href="/blogs-detail" className="block">
              <article className="gym-blog-card-gradient rounded-xl overflow-hidden gym-blog-hover-lift transition-all duration-500 group">
                <div className="relative h-48 overflow-hidden">
                  <Image
                    src="/images/gym-blog-3.svg"
                    alt="Weight Loss Journey"
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase">
                      Weight Loss
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-semibold text-xl mb-3 group-hover:gym-blog-custom-text-green transition-colors">
                    Lost 50lbs in 6 Months
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Mark&apos;s incredible weight loss journey through consistent
                    training and meal prep dedication.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">5 min read</span>
                    <i className="fas fa-arrow-up-right gym-blog-custom-text-green group-hover:transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"></i>
                  </div>
                </div>
              </article>
            </Link>

            <Link href="/blogs-detail" className="block">
              <article className="gym-blog-card-gradient rounded-xl overflow-hidden gym-blog-hover-lift transition-all duration-500 group">
                <div className="relative h-48 overflow-hidden">
                  <Image
                    src="/images/gym-blog-2.svg"
                    alt="Strength Training"
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase">
                      Strength
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-semibold text-xl mb-3 group-hover:gym-blog-custom-text-green transition-colors">
                    Deadlifting 400lbs at 55
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    How Jessica proved that age is just a number by achieving her
                    strength goals later in life.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">6 min read</span>
                    <i className="fas fa-arrow-up-right gym-blog-custom-text-green group-hover:transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"></i>
                  </div>
                </div>
              </article>
            </Link>

            <Link href="/blogs-detail" className="block">
              <article className="gym-blog-card-gradient rounded-xl overflow-hidden gym-blog-hover-lift transition-all duration-500 group">
                <div className="relative h-48 overflow-hidden">
                  <Image
                    src="/images/gym-blog-1.svg"
                    alt="Marathon Training"
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase">
                      Endurance
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-semibold text-xl mb-3 group-hover:gym-blog-custom-text-green transition-colors">
                    First Marathon at 40
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    David&apos;s journey from casual jogger to marathon finisher in
                    just 8 months of training.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">7 min read</span>
                    <i className="fas fa-arrow-up-right gym-blog-custom-text-green group-hover:transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"></i>
                  </div>
                </div>
              </article>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedStories;
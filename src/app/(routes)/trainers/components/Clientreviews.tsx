'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

type Review = {
  id: number;
  name: string;
  rating: number;
  text: string;
  avatar: string;
  highlight?: boolean;
};

const reviews: Review[] = [
  {
    id: 1,
    name: 'Ava M.',
    rating: 5.0,
    text:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    avatar: 'https://i.pravatar.cc/150?img=32',
  },
  {
    id: 2,
    name: 'Liam K.',
    rating: 5.0,
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.',
    avatar: 'https://i.pravatar.cc/150?img=45',
  },
  {
    id: 3,
    name: 'Sophia R.',
    rating: 5.0,
    text:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    avatar: 'https://i.pravatar.cc/150?img=28',
  },
  {
    id: 4,
    name: 'Noah P.',
    rating: 5.0,
    text:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.',
    avatar: 'https://i.pravatar.cc/150?img=12',
    highlight: true,
  },
  {
    id: 5,
    name: 'Olivia T.',
    rating: 5.0,
    text:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    avatar: 'https://i.pravatar.cc/150?img=52',
  },
  {
    id: 6,
    name: 'Ethan B.',
    rating: 5.0,
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.',
    avatar: 'https://i.pravatar.cc/150?img=14',
  },
  {
    id: 7,
    name: 'Mia C.',
    rating: 5.0,
    text:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    avatar: 'https://i.pravatar.cc/150?img=11',
  },
  {
    id: 8,
    name: 'James H.',
    rating: 5.0,
    text:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.',
    avatar: 'https://i.pravatar.cc/150?img=36',
  },
  {
    id: 9,
    name: 'Emma D.',
    rating: 5.0,
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.',
    avatar: 'https://i.pravatar.cc/150?img=21',
  },
  {
    id: 10,
    name: 'Lucas V.',
    rating: 5.0,
    text:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    avatar: 'https://i.pravatar.cc/150?img=41',
  },
    {
    id: 11,
    name: 'Lucas V.',
    rating: 5.0,
    text:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    avatar: 'https://i.pravatar.cc/150?img=41',
  },
    {
    id: 12,
    name: 'Lucas V.',
    rating: 5.0,
    text:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    avatar: 'https://i.pravatar.cc/150?img=41',
  }
  
];

const StarRating: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex items-center gap-1 text-yellow-400" aria-label={`${rating} out of 5 stars`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <span key={i} className="h-4 w-4 text-yellow-400">★</span>
    ))}
    <span className="ml-2 text-sm font-semibold text-gray-900">{rating.toFixed(1)}</span>
  </div>
);

const Clientreviews: React.FC = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-white to-gray-50 ">
      {/* subtle background accents */}
      <div className="pointer-events-none absolute -top-32 right-[-6rem] h-72 w-72 rounded-full bg-lime-200/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-6rem] left-[-6rem] h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />

      <div className="mx-auto py-16 lg:py-20 px-4 sm:px-8 lg:px-20 ">
        {/* Header */}
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gray-500 shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-lime-600" />
            Testimonials
          </div>

          <h2 className="text-3xl font-bold uppercase tracking-tight text-black sm:text-4xl">
            What Our Clients Say
          </h2>
        </div>

        {/* Cards: responsive masonry using CSS columns */}
        <div className="mt-10 columns-1 gap-6 sm:columns-2 lg:columns-3 xl:columns-4">
          {reviews.map((r) => (
            <article
              key={r.id}
              className={[
                'group relative mb-6 break-inside-avoid rounded-[15px] border bg-white p-6 shadow-md shadow-gray-200/50 transition-all duration-300',
                r.highlight
                  ? 'border-lime-300 ring-2 ring-lime-300'
                  : 'border-gray-200 hover:-translate-y-1 hover:shadow-xl hover:ring-1 hover:ring-lime-300/60',
              ].join(' ')}
            >
              {/* decorative quote icon */}
              <span className="absolute left-5 top-5 h-4 w-4 text-lime-500/60">❝</span>

              {/* Upper: avatar + name + rating */}
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-gray-100 group-hover:ring-lime-200">
                    <Image
                      src={r.avatar}
                      alt={`${r.name} avatar`}
                      fill
                      sizes="40px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-900">{r.name}</span>
                    <span className="text-xs text-gray-500">Verified Client</span>
                  </div>
                </div>

                <StarRating rating={r.rating} />
              </div>

              {/* Body */}
              <p className="mx-auto max-w-[270px] text-center text-sm leading-6 text-gray-600">
                {r.text}
              </p>
            </article>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-8 flex justify-center">
          <Link
            href="/testimonials"
            className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:border-lime-400 hover:text-lime-700"
          >
            Read more stories
            <span className="text-gray-500 transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Clientreviews;

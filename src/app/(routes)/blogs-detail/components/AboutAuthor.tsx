import React from 'react';
import Image from 'next/image';
import { Author } from '../services/blogDetailService';

interface AboutAuthorProps {
  author?: Author;
}

const AboutAuthor: React.FC<AboutAuthorProps> = ({ author }) => {
  if (!author) {
    return null;
  }

  const formatMemberSince = (dateString?: string) => {
    if (!dateString) return 'Member';
    const date = new Date(dateString);
    return `Member since ${date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    })}`;
  };

  return (
    <section className="gym-blog-custom-bg-darker rounded-xl p-6 lg:p-8 mb-12">
      <h3 className="font-montserrat font-bold text-2xl mb-6 text-white">
        About the Author
      </h3>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Author Avatar */}
        <div className="flex-shrink-0">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28">
            <Image
              src={author.avatarUrl || author.avatar || '/images/gym-1.svg'}
              alt={author.name}
              fill
              className="object-cover rounded-full border-3 border-green-500"
            />
          </div>
        </div>

        {/* Author Info */}
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4">
            <div>
              <h4 className="font-bold text-xl text-white mb-1">
                {author.name}
              </h4>
              <p className="text-gray-400 text-sm mb-2">
                {formatMemberSince(author.createdAt)}
              </p>
            </div>

            {/* Author Stats */}
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <div className="font-bold text-green-500 text-lg">
                  {author.blogCount || 0}
                </div>
                <div className="text-gray-400">Articles</div>
              </div>
            </div>
          </div>

          {/* Author Bio */}
          {author.bio && (
            <div className="mb-4">
              <p className="text-gray-300 text-sm leading-relaxed">
                {author.bio}
              </p>
            </div>
          )}

          {/* Contact Info */}
          <div className="flex items-center gap-4 text-sm">
            <a
              href={`mailto:${author.email}`}
              className="flex items-center gap-2 text-green-500 hover:text-green-400 transition-colors"
            >
              <i className="far fa-envelope"></i>
              <span>Contact Author</span>
            </a>

            <div className="flex items-center gap-2 text-gray-400">
              <i className="far fa-calendar"></i>
              <span>{formatMemberSince(author.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative border */}
      <div className="mt-6 pt-6 border-t border-gray-700">
        <div className="flex items-center justify-center">
          <div className="w-16 h-1 gym-blog-custom-bg-green rounded-full"></div>
        </div>
      </div>
    </section>
  );
};

export default AboutAuthor;
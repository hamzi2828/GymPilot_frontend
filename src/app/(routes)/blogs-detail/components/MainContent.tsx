"use client";

import React from "react";
import { sanitizeHtml } from "@/helper/sanitize";

interface MainContentProps {
  content: string;
}

// The article body, exactly as written in the blog admin. The sample
// "Exercise Breakdown" / "Key Takeaways" blocks this used to carry (commented
// out, with images that never existed) were template content, not the gym's.
const MainContent: React.FC<MainContentProps> = ({
  content,
}) => {
  return (
    <div className="max-w-4xl" >
      <div
        className="prose prose-lg max-w-none mb-12"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
      />
    </div>
  );
};

export default MainContent;

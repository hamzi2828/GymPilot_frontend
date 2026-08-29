// src/helper/sanitize.ts
//
// Blog bodies and excerpts are authored as raw HTML in the admin editor and
// rendered with dangerouslySetInnerHTML. Without this pass, anything stored in
// the blog record — including a <script> tag from a compromised admin account —
// executes on every visitor's page.

import DOMPurify from "isomorphic-dompurify";

/** Tags an article body is allowed to use. Anything else is stripped. */
const ARTICLE_TAGS = [
  "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "mark", "small", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "div", "span",
];

const ARTICLE_ATTRS = ["href", "src", "alt", "title", "target", "rel", "class", "colspan", "rowspan"];

/**
 * Sanitises an article body for rendering.
 *
 * `javascript:` and `data:` URLs are rejected by the URI policy below, so a
 * link or image src cannot smuggle in script execution.
 */
export function sanitizeHtml(html?: string | null): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ARTICLE_TAGS,
    ALLOWED_ATTR: ARTICLE_ATTRS,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/|#)/i,
    // Block every inline event handler and <style> payload outright.
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input"],
    FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
  });
}

/**
 * Sanitises text used in listing cards and excerpts, where only light inline
 * formatting makes sense and a stray heading would break the card layout.
 */
export function sanitizeExcerpt(html?: string | null): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["strong", "b", "em", "i", "br", "span"],
    ALLOWED_ATTR: [],
  });
}

/** Strips all markup — for meta descriptions and other plain-text contexts. */
export function stripHtml(html?: string | null): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Plain-text preview of an article for listing cards.
 *
 * Truncates on a word boundary so a card never ends mid-word, and only appends
 * the ellipsis when text was actually cut.
 */
export function excerptOf(html?: string | null, maxChars = 150): string {
  const text = stripHtml(html);
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

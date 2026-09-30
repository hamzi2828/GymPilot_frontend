// src/helper/scriptJson.ts
//
// JSON to put inside an inline <script> element, such as the structured data
// in the root layout. JSON.stringify leaves "<", ">" and "&" as they are, so a
// stored value containing "</script>" -- a gym description, a social link --
// would end the element early and the rest would be parsed as HTML: script
// running on every page of the site, the admin panel included. Written as
// <, > and & the JSON still parses to exactly the same value
// but can never close the element or open a comment. U+2028 and U+2029 are
// escaped as well: valid inside JSON strings, but line breaks to older
// JavaScript parsers.

const UNSAFE = /[<>&\u2028\u2029]/g;

/** JSON.stringify, safe to place between <script> and </script>. */
export function scriptJson(value: unknown): string {
  return (JSON.stringify(value) ?? "null").replace(
    UNSAFE,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

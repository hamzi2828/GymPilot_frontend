import ContentPageLayout from "@/components/ContentPageLayout";
import { getContentPage } from "./services/contentService";

// Server component on purpose: the questions and answers should be in the
// HTML that arrives, not painted in after hydration. This page used to be a
// hardcoded client component whose first question was "How Do I Shop?", left
// over from the clothing store this project was converted from.
export default async function FaqsPage() {
  const page = await getContentPage("faqs");
  return <ContentPageLayout page={page} activeHref="/faqs" fallbackTitle="Frequently asked questions" />;
}

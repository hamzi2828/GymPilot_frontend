import ContentPageLayout from "@/components/ContentPageLayout";
import { getContentPage } from "../faqs/services/contentService";

export default async function TermsPage() {
  const page = await getContentPage("terms");
  return <ContentPageLayout page={page} activeHref="/terms" fallbackTitle="Terms and conditions" />;
}

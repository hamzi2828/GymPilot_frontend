import ContentPageLayout from "@/components/ContentPageLayout";
import { getContentPage } from "../faqs/services/contentService";

export default async function PrivacyPolicyPage() {
  const page = await getContentPage("privacy-policy");
  return <ContentPageLayout page={page} activeHref="/privacy-policy" fallbackTitle="Privacy policy" />;
}

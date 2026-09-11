import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { checkDataIntegrity, checkSchema, getAdminAudit, getAnalyticsSummary, getCategories, getFaqs, getInquiryCommercialInsights, getInquiryCommercialSummary, getInquiryWorkspace, getProducts, getSiteSettings, getTestimonials } from '@/lib/db';
import AdminDashboard from '@/components/AdminDashboard';
import { encodeInquiryHistoryCursor } from '@/lib/crm-cursor';
export const dynamic='force-dynamic';
export const revalidate=0;
export const metadata={robots:{index:false,follow:false}};
export default async function AdminPage(){
  if(!(await isAdmin()))redirect('/admin/login');
  const [products,categories,workspace,commercialSummary,commercialInsights,settings,testimonials,faqs,analytics,audit,schema,integrity]=await Promise.all([getProducts(true),getCategories(true),getInquiryWorkspace(80),getInquiryCommercialSummary(),getInquiryCommercialInsights(30),getSiteSettings(),getTestimonials(true),getFaqs(true),getAnalyticsSummary(30),getAdminAudit(80),checkSchema(),checkDataIntegrity()]);
  return <AdminDashboard initialProducts={products} initialCategories={categories} initialInquiries={workspace.items} initialInquiryHistoryCursor={encodeInquiryHistoryCursor(workspace.history.next)} initialInquiryHistoryHasMore={workspace.history.has_more} initialCustomerStats={workspace.customer_stats} initialCommercialSummary={commercialSummary} initialCommercialInsights={commercialInsights} initialSettings={settings} initialTestimonials={testimonials} initialFaqs={faqs} analytics={analytics} audit={audit} schema={schema} integrity={integrity} hasDatabase={Boolean(process.env.DATABASE_URL)} hasSiteUrl={Boolean(process.env.NEXT_PUBLIC_SITE_URL)}/>;
}

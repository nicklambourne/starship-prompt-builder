import { SiteFooter } from "@/components/builder/SiteFooter";
import { ReferenceHeader } from "@/components/site/ReferenceHeader";

export default function ReferenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ReferenceHeader />
      {children}
      <SiteFooter />
    </div>
  );
}

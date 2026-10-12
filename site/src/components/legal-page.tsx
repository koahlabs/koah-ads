import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { SiteFooter } from "@/components/site-footer";
import { AuthNav } from "@/components/auth-nav";
import { BrandLink } from "@/components/brand-link";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main id="main-content" className="site-shell legal-page">
      <header>
        <div className="intro-heading">
          <div className="wordmark"><BrandLink /></div>
          <AuthNav />
        </div>
        <Link className="legal-back" href="/"><Icon name="arrow-left" /> Back to Sidequest</Link>
        <h1 className="legal-title">{title}</h1>
        <p className="legal-date">Last updated October 11, 2026</p>
      </header>
      <article className="legal-copy">{children}</article>
      <SiteFooter />
    </main>
  );
}

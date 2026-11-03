import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export async function generateMetadata({ params }: PageProps<"/[locale]/methodology">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "methodology" });
  return { title: t("title") };
}

function slug(children: React.ReactNode): string {
  const text = Array.isArray(children) ? children.join("") : String(children ?? "");
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
}

/** Renders docs/methodology.md (English; the methodology is maintained in one language). */
export default async function MethodologyPage({ params }: PageProps<"/[locale]/methodology">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const md = readFileSync(path.join(process.cwd(), "docs", "methodology.md"), "utf8");
  return (
    <article className="prose-doc max-w-3xl" lang="en">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => <h2 id={slug(children)}>{children}</h2>,
          h3: ({ children }) => <h3 id={slug(children)}>{children}</h3>,
        }}
      >
        {md}
      </ReactMarkdown>
    </article>
  );
}

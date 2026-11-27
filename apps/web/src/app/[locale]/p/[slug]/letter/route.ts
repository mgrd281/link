import { servePreviewDocument } from "@/features/documents/serve";

// Rendered for each request (never prerendered, never in generateStaticParams), on Node (the PDF writer reads the fonts).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A prepared application page's Anschreiben (cover letter) as a PDF: /<locale>/p/<slug>/letter, private and never indexed (features/documents/serve.ts). */
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Response> {
  const { locale, slug } = await params;
  return servePreviewDocument("letter", locale, slug);
}

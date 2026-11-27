import { servePublicDocument } from "@/features/documents/serve";

// Rendered for each request (never prerendered, never in generateStaticParams), on Node (the PDF writer reads the fonts).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A public application page's cover letter and CV in one file as a PDF: /<username>/application, rewritten here by the proxy (features/documents/serve.ts). */
export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }): Promise<Response> {
  const { username } = await params;
  return servePublicDocument("application", username, request);
}

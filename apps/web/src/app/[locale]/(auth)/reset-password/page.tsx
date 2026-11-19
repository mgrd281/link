import { redirect } from "next/navigation";

/** There are no passwords any more (sign-in is a code by email): old links go to sign-in. */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/login`);
}

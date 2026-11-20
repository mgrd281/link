import { PageWall } from "@/features/marketing/page-wall";

/**
 * Beside the sign-up and sign-in forms: the tilted wall of example pages made with Linkyo, its
 * columns drifting past each other once, then resting (see PageWall). Wide screens only.
 */
export function AuthWall() {
  return <PageWall moving className="hidden lg:block" />;
}

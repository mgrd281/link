import { usernameOf } from "@/features/creator/revalidate";
import { serviceSupabase } from "@/lib/supabase/server";

/**
 * A customer's page address for the team's routes. Row-level security shows a profile only to its
 * owner, so this read uses the service client (server only). It never answers a caller: the routes
 * use it to drop the cached public page after the database allowed their action. Null when the
 * profile or the secret key is missing (then nothing is dropped and the page refreshes within its
 * minute, as before).
 */
export async function customerUsername(customer: string): Promise<string | null> {
  try {
    return await usernameOf(serviceSupabase(), customer);
  } catch {
    return null;
  }
}

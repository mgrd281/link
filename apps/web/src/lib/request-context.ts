/**
 * The address and rough location of a request, from the headers the host sets (Vercel:
 * x-forwarded-for and x-vercel-ip-*). No third party is asked.
 */
export interface RequestPlace {
  ip: string;
  country?: string | undefined;
  city?: string | undefined;
}

const decode = (value: string | null) => {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export function requestPlace(headers: Headers): RequestPlace {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = (forwarded === undefined || forwarded === "" ? (headers.get("x-real-ip") ?? "") : forwarded).replace(/^::ffff:/, "");
  const country = headers.get("x-vercel-ip-country") ?? undefined;
  const city = decode(headers.get("x-vercel-ip-city"));
  return { ip, ...(country ? { country } : {}), ...(city ? { city } : {}) };
}

/** Local development has no forwarding proxy: the loopback address stands in. */
export const ipForLog = (place: RequestPlace) => place.ip || "127.0.0.1";

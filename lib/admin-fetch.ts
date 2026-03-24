/**
 * Client-side helper for making API calls.
 * No auth required — all endpoints are public.
 */

interface ApiFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
}

export async function adminFetch(
  url: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const { headers = {}, ...rest } = options;
  return fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

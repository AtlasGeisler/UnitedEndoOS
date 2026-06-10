import { QueryClient } from "@tanstack/react-query";

// A thin fetch wrapper. Every request sends the session cookie and throws on a
// non-2xx response so TanStack Query surfaces errors cleanly.
export async function apiRequest<T = unknown>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    const message = await res
      .json()
      .then((d) => d.error)
      .catch(() => res.statusText);
    throw new Error(message || "Request failed");
  }
  return res.json() as Promise<T>;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) =>
        apiRequest("GET", queryKey.join("/") as string),
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

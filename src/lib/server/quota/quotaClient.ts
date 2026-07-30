/** Minimal Supabase surface used by quota helpers (rpc + study_sets probe). */
export type QuotaClient = {
  rpc: (
    functionName: string,
    args: Record<string, string>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        limit: (count: number) => PromiseLike<{ data: Array<{ id: string }> | null; error: { message: string } | null }>;
      };
    };
  };
};

/** Compile-time boundary: full SSR client → minimal quota interface. */
export function toQuotaClient(client: unknown): QuotaClient {
  return client as QuotaClient;
}

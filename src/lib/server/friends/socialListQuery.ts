import { z } from "zod";

const schema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(2048).nullable().default(null),
});

export function parseSocialListQuery(params: URLSearchParams) {
  return schema.parse({ limit: params.get("limit") ?? undefined, cursor: params.get("cursor") });
}

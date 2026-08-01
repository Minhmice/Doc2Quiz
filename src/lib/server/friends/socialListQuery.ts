import { z } from "zod";

const schema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(2048).nullable().default(null),
});

const friendsSchema = schema.extend({
  presence: z.enum(["online", "offline"]).default("offline"),
});

export type SocialListQuery = z.infer<typeof schema>;
export type FriendsListQuery = z.infer<typeof friendsSchema>;

export function parseSocialListQuery(params: URLSearchParams): SocialListQuery {
  return schema.parse({ limit: params.get("limit") ?? undefined, cursor: params.get("cursor") });
}

export function parseFriendsListQuery(params: URLSearchParams): FriendsListQuery {
  return friendsSchema.parse({
    limit: params.get("limit") ?? undefined,
    cursor: params.get("cursor"),
    presence: params.get("presence") ?? undefined,
  });
}

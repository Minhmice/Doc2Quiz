export type SocialMetricName =
  | "presence_heartbeats_accepted"
  | "presence_heartbeats_rate_limited"
  | "presence_snapshot_redis_errors"
  | "redis_latency_ms"
  | "redis_reconnects"
  | "social_route_5xx"
  | "activity_events_queued"
  | "activity_batch_failures";

type SocialMetricFields = Record<string, string | number | boolean | undefined>;
type SocialMetric = { name: SocialMetricName; fields: SocialMetricFields };
type SocialMetricEmitter = (metric: SocialMetric) => void;

const sensitive = /url|credential|password|value|token|session|ip/i;

export function redactSocialMetric(fields: SocialMetricFields) {
  return Object.fromEntries(Object.entries(fields).filter(([key, value]) => !sensitive.test(key) && value !== undefined));
}

export function createSocialObservability(emit: SocialMetricEmitter = () => {}) {
  return {
    count(name: SocialMetricName, fields: SocialMetricFields = {}) {
      emit({ name, fields: redactSocialMetric(fields) });
    },
  };
}

export const socialObservability = createSocialObservability();

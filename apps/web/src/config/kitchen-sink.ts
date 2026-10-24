import 'server-only';

/**
 * /admin/kitchen-sink is a development tool: on in `next dev`, off in production
 * builds unless KITCHEN_SINK_ENABLED=true (e.g. a staging review).
 */
export function isKitchenSinkEnabled(): boolean {
  if (process.env.KITCHEN_SINK_ENABLED === 'true') return true;
  if (process.env.KITCHEN_SINK_ENABLED === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

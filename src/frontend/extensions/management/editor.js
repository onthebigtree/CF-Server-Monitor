// Keep optional management metadata through the native settings form projection.
export function editorSettings(settings = {}, ids = []) {
  const enabled=settings.management_enabled === true || settings.management_enabled === 'true';
  const hosts=Array.isArray(settings.management_host_ids) ? settings.management_host_ids : [];
  return {...settings, management_host_ids:hosts, management_enabled:enabled && ids.some(id=>hosts.includes(id))};
}
export function nativeEditPayload(payload, settings) {
  if (!editorSettings(settings,[payload.id]).management_enabled) return payload;
  const copy={...payload};
  for (const key of ['traffic_limit','traffic_calc_type','reset_day','rx_correction','tx_correction']) delete copy[key];
  return copy;
}

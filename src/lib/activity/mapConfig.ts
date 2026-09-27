/**
 * Map tiles, in one place.
 *
 * OpenStreetMap's standard tile server is free for light personal use under
 * its tile usage policy (https://operations.osmfoundation.org/policies/tiles/):
 * attribution shown, no bulk prefetching, a real User-Agent/Referer (browsers
 * and the Android web view send these). It is NOT meant for a commercial app:
 * before RightPace is sold or widely distributed, switch this to a commercial
 * tile provider (MapTiler, Stadia, Mapbox, Thunderforest...) with its own key
 * and attribution.
 */
export const MAP_TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
} as const

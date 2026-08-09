import { PUBLIC_MAPTILER_API_KEY } from '$env/static/public';

// OpenStreetMap's public tile server (tile.openstreetmap.org) isn't meant
// for production apps — it rate-limits/blocks traffic without warning,
// which is what was actually causing blank maps. MapTiler's free tier
// serves the same MapLibre GL library a proper vector style instead of
// raw raster tiles.
export const MAP_STYLE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${PUBLIC_MAPTILER_API_KEY}`;

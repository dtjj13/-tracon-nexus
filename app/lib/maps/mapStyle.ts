import type { StyleSpecification } from "maplibre-gl";

const MAP_ATTRIBUTION =
  '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>';

export function createTraconMapStyle(mapTilerKey: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      "tracon-streets": {
        type: "raster",
        tiles: [
          `https://api.maptiler.com/maps/streets-v2-dark/256/{z}/{x}/{y}@2x.png?key=${encodeURIComponent(mapTilerKey)}`,
        ],
        tileSize: 256,
        attribution: MAP_ATTRIBUTION,
      },
    },
    layers: [
      {
        id: "tracon-streets",
        type: "raster",
        source: "tracon-streets",
      },
    ],
  };
}

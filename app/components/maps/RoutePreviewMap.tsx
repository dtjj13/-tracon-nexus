"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { createTraconMapStyle } from "../../lib/maps/mapStyle";

maplibregl.setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString()
);

type RoutePreviewMapProps = {
  coordinates: [number, number][];
  pickupLabel: string;
  dropoffLabel: string;
  className?: string;
};

const mapTilerKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim();

export default function RoutePreviewMap({
  coordinates,
  pickupLabel,
  dropoffLabel,
  className = "min-h-64 rounded-2xl border border-cyan-400/20",
}: RoutePreviewMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || !mapTilerKey || coordinates.length < 2) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createTraconMapStyle(mapTilerKey),
      center: coordinates[0],
      zoom: 5,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );

    const pickupMarker = new maplibregl.Marker({ color: "#22d3ee" })
      .setLngLat(coordinates[0])
      .setPopup(new maplibregl.Popup({ offset: 20 }).setText(pickupLabel))
      .addTo(map);

    const dropoffMarker = new maplibregl.Marker({ color: "#a855f7" })
      .setLngLat(coordinates.at(-1) ?? coordinates[0])
      .setPopup(new maplibregl.Popup({ offset: 20 }).setText(dropoffLabel))
      .addTo(map);

    map.on("load", () => {
      map.addSource("tracon-route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates,
          },
        },
      });

      map.addLayer({
        id: "tracon-route-glow",
        type: "line",
        source: "tracon-route",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#0891b2",
          "line-opacity": 0.35,
          "line-width": 9,
        },
      });

      map.addLayer({
        id: "tracon-route-line",
        type: "line",
        source: "tracon-route",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#67e8f9",
          "line-width": 4,
        },
      });

      const bounds = coordinates.reduce(
        (current, coordinate) => current.extend(coordinate),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
      );

      map.fitBounds(bounds, {
        padding: 48,
        maxZoom: 11,
        duration: 0,
      });
    });

    return () => {
      pickupMarker.remove();
      dropoffMarker.remove();
      map.remove();
    };
  }, [coordinates, dropoffLabel, pickupLabel]);

  if (!mapTilerKey) {
    return (
      <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-700 bg-[#06111f] p-6 text-center">
        <div>
          <p className="text-sm font-semibold text-slate-300">
            Route calculated—map display needs the MapTiler key
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Add NEXT_PUBLIC_MAPTILER_API_KEY to the local environment, then
            restart Tracon Nexus.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden bg-[#06111f] ${className}`}
      aria-label={`Route map from ${pickupLabel} to ${dropoffLabel}`}
    />
  );
}

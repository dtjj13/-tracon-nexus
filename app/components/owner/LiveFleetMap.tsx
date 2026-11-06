"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { createTraconMapStyle } from "../../lib/maps/mapStyle";

maplibregl.setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString()
);

export type FleetMapLocation = {
  id: string;
  latitude: number;
  longitude: number;
  driverName: string;
  loadNumber: string;
  truckNumber: string;
  trackingState: "live" | "signal-lost" | "stopped";
};

type Props = {
  locations: FleetMapLocation[];
  selectedId: string | null;
  onSelect: (loadId: string) => void;
};

const mapTilerKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim();

export default function LiveFleetMap({
  locations,
  selectedId,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !mapTilerKey) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createTraconMapStyle(mapTilerKey),
      center: [-98.5795, 39.8283],
      zoom: 3.4,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );
    map.on("load", () => setMapReady(true));
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (locations.length === 0) {
      map.easeTo({ center: [-98.5795, 39.8283], zoom: 3.4 });
      return;
    }

    const bounds = new maplibregl.LngLatBounds();

    locations.forEach((location) => {
      const selected = location.id === selectedId;
      const color = markerColor(location.trackingState);
      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.setAttribute(
        "aria-label",
        `Select ${location.driverName}, ${location.loadNumber}`
      );
      markerElement.style.width = selected ? "28px" : "22px";
      markerElement.style.height = selected ? "28px" : "22px";
      markerElement.style.borderRadius = "9999px";
      markerElement.style.background = color;
      markerElement.style.border = "4px solid #07101A";
      markerElement.style.boxShadow = `0 0 0 2px ${color}, 0 8px 22px rgba(0,0,0,.55)`;
      markerElement.style.cursor = "pointer";
      markerElement.addEventListener("click", () => {
        onSelectRef.current(location.id);
      });

      const popupContent = document.createElement("div");
      popupContent.style.minWidth = "150px";
      popupContent.style.color = "#0f172a";

      const driver = document.createElement("strong");
      driver.textContent = location.driverName;

      const detail = document.createElement("div");
      detail.style.marginTop = "4px";
      detail.style.fontSize = "12px";
      detail.textContent = `${location.loadNumber} · Truck ${location.truckNumber}`;

      popupContent.append(driver, detail);

      const marker = new maplibregl.Marker({
        element: markerElement,
        anchor: "center",
      })
        .setLngLat([location.longitude, location.latitude])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setDOMContent(popupContent))
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend([location.longitude, location.latitude]);
    });

    if (locations.length === 1) {
      map.easeTo({
        center: [locations[0].longitude, locations[0].latitude],
        zoom: 8,
      });
    } else {
      map.fitBounds(bounds, {
        padding: 72,
        maxZoom: 9,
        duration: 500,
      });
    }
  }, [locations, mapReady, selectedId]);

  if (!mapTilerKey) {
    return (
      <div className="grid h-[520px] place-items-center bg-[#050B12] p-8 text-center">
        <div>
          <p className="font-semibold text-slate-300">Fleet map is not configured</p>
          <p className="mt-2 text-xs text-slate-500">
            Add the MapTiler key and restart Tracon Nexus.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[520px] w-full overflow-hidden bg-[#050B12]">
      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-wrap gap-2 rounded-xl border border-slate-700/80 bg-[#07101A]/95 p-3 text-[10px] font-semibold text-slate-300 shadow-xl backdrop-blur">
        <LegendDot color="#22c55e" label="Tracking Live" />
        <LegendDot color="#ef4444" label="Signal Lost" />
        <LegendDot color="#94a3b8" label="Tracking Stopped" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function markerColor(state: FleetMapLocation["trackingState"]) {
  if (state === "live") return "#22c55e";
  if (state === "signal-lost") return "#ef4444";
  return "#94a3b8";
}

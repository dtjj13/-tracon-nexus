"use client";

import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

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

export default function LiveFleetMap({
  locations,
  selectedId,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      if (!containerRef.current || mapRef.current) return;

      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([39.8283, -98.5795], 4);

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }
      ).addTo(map);

      mapRef.current = map;
      markerLayerRef.current = L.layerGroup().addTo(map);
      setMapReady(true);

      window.requestAnimationFrame(() => map.invalidateSize());
    }

    initializeMap();

    return () => {
      cancelled = true;
      markerLayerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      !mapReady ||
      !mapRef.current ||
      !markerLayerRef.current
    ) {
      return;
    }

    let cancelled = false;

    async function updateMarkers() {
      const L = await import("leaflet");

      if (
        cancelled ||
        !mapRef.current ||
        !markerLayerRef.current
      ) {
        return;
      }

      markerLayerRef.current.clearLayers();

      if (locations.length === 0) {
        mapRef.current.setView([39.8283, -98.5795], 4);
        return;
      }

      const bounds = L.latLngBounds([]);

      locations.forEach((location) => {
        const selected = location.id === selectedId;
        const color = markerColor(location.trackingState);
        const size = selected ? 26 : 20;

        const icon = L.divIcon({
          className: "",
          html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:4px solid #07101A;box-shadow:0 0 0 2px ${color},0 6px 18px rgba(0,0,0,.55);"></span>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker(
          [location.latitude, location.longitude],
          { icon }
        );

        const tooltip = document.createElement("div");
        tooltip.className = "space-y-0.5";

        const driver = document.createElement("p");
        driver.className = "font-semibold";
        driver.textContent = location.driverName;

        const detail = document.createElement("p");
        detail.textContent =
          `${location.loadNumber} · Truck ${location.truckNumber}`;

        tooltip.append(driver, detail);

        marker.bindTooltip(tooltip, {
          direction: "top",
          offset: [0, -12],
          opacity: 0.96,
        });

        marker.on("click", () => {
          onSelectRef.current(location.id);
        });

        marker.addTo(markerLayerRef.current!);

        bounds.extend([
          location.latitude,
          location.longitude,
        ]);
      });

      if (locations.length === 1) {
        mapRef.current.setView(
          [
            locations[0].latitude,
            locations[0].longitude,
          ],
          8
        );
      } else {
        mapRef.current.fitBounds(bounds.pad(0.18), {
          maxZoom: 9,
        });
      }
    }

    updateMarkers();

    return () => {
      cancelled = true;
    };
  }, [locations, mapReady, selectedId]);

  return (
    <div className="relative h-[520px] w-full overflow-hidden bg-[#050B12]">
      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute bottom-4 left-4 z-[500] flex flex-wrap gap-2 rounded-xl border border-slate-700/80 bg-[#07101A]/95 p-3 text-[10px] font-semibold text-slate-300 shadow-xl backdrop-blur">
        <LegendDot
          color="#22c55e"
          label="Tracking Live"
        />

        <LegendDot
          color="#ef4444"
          label="Signal Lost"
        />

        <LegendDot
          color="#94a3b8"
          label="Tracking Stopped"
        />
      </div>
    </div>
  );
}

function LegendDot({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />

      {label}
    </span>
  );
}

function markerColor(
  state: FleetMapLocation["trackingState"]
) {
  if (state === "live") return "#22c55e";
  if (state === "signal-lost") return "#ef4444";

  return "#94a3b8";
}
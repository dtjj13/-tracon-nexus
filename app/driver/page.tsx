"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getUserRole } from "../lib/getUserRole";

type Load = {
  id: string;
  tracon_id: string;
  broker_load_id?: string;
  bol_number?: string;
  pickup: string;
  dropoff: string;
  driver: string;
  status: string;
  bol_url?: string;
  pod_url?: string;
  driver_lat?: number;
  driver_lng?: number;
  location_updated_at?: string;
};

export default function DriverPage() {
  const router = useRouter();
useEffect(() => {
  const checkRole = async () => {
    const role = await getUserRole();

    if (!role) {
      router.push("/login");
      return;
    }

    if (role !== "driver") {
      router.push("/dispatch");
    }
  };

  checkRole();
}, [router]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [trackingLoadId, setTrackingLoadId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 🔥 FETCH LOADS (FILTERED BY LOGGED-IN DRIVER)
  const fetchLoads = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("loads")
      .select("*")
      .eq("driver", user.email)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setLoads(data || []);
  };

  useEffect(() => {
    fetchLoads();
  }, []);

  // 🔥 UPDATE STATUS
  const updateStatus = async (loadId: string, status: string) => {
    const { error } = await supabase
      .from("loads")
      .update({ status })
      .eq("id", loadId);

    if (error) {
      alert(error.message);
      return;
    }

    fetchLoads();
  };

  // 🔥 GPS UPDATE
  const updateLocation = (loadId: string) => {
    if (!navigator.geolocation) {
      alert("GPS not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { error } = await supabase
        .from("loads")
        .update({
          driver_lat: pos.coords.latitude,
          driver_lng: pos.coords.longitude,
          location_updated_at: new Date().toISOString(),
        })
        .eq("id", loadId);

      if (error) {
        alert(error.message);
        return;
      }

      fetchLoads();
    });
  };

  const startTracking = (loadId: string) => {
    if (intervalRef.current) return;

    setTrackingLoadId(loadId);

    updateLocation(loadId);

    intervalRef.current = setInterval(() => {
      updateLocation(loadId);
    }, 30000);
  };

  const stopTracking = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setTrackingLoadId(null);
    }
  };

  // 🔥 UPLOAD FILE
  const uploadFile = async (
    loadId: string,
    file: File | null,
    type: "BOL" | "POD"
  ) => {
    if (!file) return;

    const fileName = `${type}-${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, file);

    if (uploadError) {
      alert(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("documents").getPublicUrl(fileName);

    const updateData =
      type === "BOL"
        ? { bol_url: data.publicUrl }
        : { pod_url: data.publicUrl };

    await supabase.from("loads").update(updateData).eq("id", loadId);

    fetchLoads();
  };

  return (
    <div className="min-h-screen bg-[#050A11] text-white p-6">
      <h1 className="text-3xl font-bold">
        TRACON <span className="text-blue-500 font-light">NEXUS</span>
      </h1>

      <p className="text-slate-400 mt-2">Driver View</p>

      <div className="mt-8 space-y-4">
        {loads.map((load) => (
          <div
            key={load.id}
            className="rounded-xl border border-slate-800 bg-[#07101A] p-5"
          >
            <h2 className="text-xl font-bold">{load.tracon_id}</h2>

            <p className="mt-2">Pickup: {load.pickup}</p>
            <p>Dropoff: {load.dropoff}</p>
            <p>Driver: {load.driver}</p>
            <p className="text-blue-400 mt-1">{load.status}</p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button onClick={() => updateStatus(load.id, "Arrived at Pickup")} className="bg-slate-700 p-2 rounded">Arrived</button>
              <button onClick={() => updateStatus(load.id, "Loaded")} className="bg-blue-600 p-2 rounded">Loaded</button>
              <button onClick={() => updateStatus(load.id, "In Transit")} className="bg-blue-600 p-2 rounded">Transit</button>
              <button onClick={() => updateStatus(load.id, "Delivered")} className="bg-green-600 p-2 rounded">Delivered</button>
            </div>

            <div className="mt-4">
              {trackingLoadId === load.id ? (
                <button onClick={stopTracking} className="bg-red-600 p-2 w-full rounded">
                  Stop Tracking
                </button>
              ) : (
                <button onClick={() => startTracking(load.id)} className="bg-blue-600 p-2 w-full rounded">
                  Start Tracking
                </button>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-sm">Upload BOL</label>
              <input type="file" onChange={(e) => uploadFile(load.id, e.target.files?.[0] || null, "BOL")} />
            </div>

            <div className="mt-2">
              <label className="block text-sm">Upload POD</label>
              <input type="file" onChange={(e) => uploadFile(load.id, e.target.files?.[0] || null, "POD")} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

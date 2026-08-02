"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabase";

type Question = {
  id: string;
  category: string;
  question: string;
  vehicle_type: string;
  sort_order: number;
};

type Truck = {
  id: string;
  truck_number: string;
  active: boolean;
  vehicle_type?: string;
};

type Answer = {
  status: "Pass" | "Fail" | "N/A" | "";
  notes: string;
  photo_url: string;
};

export default function DriverDVIRPage() {
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [truckId, setTruckId] = useState("");
  const [mileage, setMileage] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedVehicleType, setSelectedVehicleType] = useState("all");

  useEffect(() => {
    fetchQuestions();
    fetchTrucks();
  }, []);

  const fetchQuestions = async () => {
    const { data, error } = await supabase
      .from("dvir_questions")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
      console.log("DVIR Questions:", data);
console.log("DVIR Error:", error);

    if (error) return alert(error.message);
    setQuestions(data || []);
  };

  const fetchTrucks = async () => {
    const { data, error } = await supabase
      .from("trucks")
      .select("*")
      .eq("active", true)
      .order("truck_number", { ascending: true });

    if (error) return alert(error.message);
    setTrucks(data || []);
  };

 const filteredQuestions = questions.filter((q: Question) => {
  return q.vehicle_type === "all" || q.vehicle_type === selectedVehicleType;
});

const currentQuestion = filteredQuestions[currentIndex];

const currentAnswer = currentQuestion
  ? answers[currentQuestion.id] || { status: "", notes: "", photo_url: "" }
  : { status: "", notes: "", photo_url: "" };

  const updateAnswer = (field: keyof Answer, value: string) => {
    if (!currentQuestion) return;

    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...(prev[currentQuestion.id] || { status: "", notes: "", photo_url: "" }),
        [field]: value,
      },
    }));
  };

  const uploadPhoto = async (file: File | null) => {
    if (!file || !currentQuestion) return;

    const fileName = `dvir-${currentQuestion.id}-${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, file, { upsert: true });

    if (uploadError) return alert(uploadError.message);

    const { data } = supabase.storage.from("documents").getPublicUrl(fileName);

    updateAnswer("photo_url", data.publicUrl);
  };

  const nextQuestion = () => {
    if (!currentAnswer.status) {
      alert("Select Pass, Fail, or N/A before continuing.");
      return;
    }

    if (currentIndex < filteredQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const previousQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const submitDVIR = async () => {
    if (!truckId) return alert("Select a truck.");
    if (!mileage) return alert("Enter mileage.");

    const unanswered = filteredQuestions.filter((q) => !answers[q.id]?.status);

    if (unanswered.length > 0) {
      alert("Complete all DVIR questions before submitting.");
      return;
    }

    setSubmitting(true);

    const rows = filteredQuestions.map((q) => ({
      truck_id: truckId,
      mileage: Number(mileage || 0),
      category: q.category,
      question: q.question,
      status: answers[q.id]?.status,
      notes: answers[q.id]?.notes || "",
      photo_url: answers[q.id]?.photo_url || "",
    }));

  const { data, error } = await supabase
  .from("dvirs")
  .insert(rows)
  .select();

console.log("DVIR SAVE DATA:", data);
console.log("DVIR SAVE ERROR:", error);

    setSubmitting(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("DVIR submitted successfully.");
router.replace("/driver");
  };

  const progress =
    filteredQuestions.length > 0
      ? Math.round(((currentIndex + 1) / filteredQuestions.length) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="space-y-6">
        <Navbar />

        <button
          onClick={() => router.back()}
          className="rounded-xl border border-slate-700 bg-[#07101A] px-4 py-2 text-sm text-slate-300 hover:border-[#00A3FF] hover:text-white"
        >
          ← Back
        </button>

        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-[#16BFFF]">
            Driver Inspection
          </p>
          <h1 className="mt-2 text-xl font-semibold">DVIR</h1>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              value={truckId}
              onChange={(e) => {
  const selectedTruck = trucks.find(
    (t) => t.id === e.target.value
  );

  setTruckId(e.target.value);

  setSelectedVehicleType(
    selectedTruck?.vehicle_type || "all"
  );
}}
              className="rounded-xl border border-slate-700 bg-[#0B1522] p-3 text-sm text-white outline-none focus:border-[#00A3FF]"
            >
              <option value="">Select Truck</option>
              {trucks.map((truck) => (
                <option key={truck.id} value={truck.id}>
                  {truck.truck_number}
                </option>
              ))}
            </select>

            <input
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="Current Mileage"
              className="rounded-xl border border-slate-700 bg-[#0B1522] p-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#00A3FF]"
            />
          </div>
        </div>

        {currentQuestion ? (
          <div className="rounded-3xl border border-slate-800 bg-[#07101A] p-5 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Question {currentIndex + 1} of {filteredQuestions.length}
                </span>
                <span>{progress}%</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-[#0B1522]">
                <div
                  className="h-full rounded-full bg-[#16BFFF]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <p className="text-xs uppercase tracking-[0.25em] text-[#16BFFF]">
              {currentQuestion.category}
            </p>

            <h2 className="mt-3 text-2xl font-bold text-white">
              {currentQuestion.question}
            </h2>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {["Pass", "Fail", "N/A"].map((status) => (
                <button
                  key={status}
                  onClick={() => updateAnswer("status", status)}
                  className={`rounded-2xl py-4 text-sm font-semibold transition ${
                    currentAnswer.status === status
                      ? status === "Pass"
                        ? "bg-green-600 text-white"
                        : status === "Fail"
                        ? "bg-red-600 text-white"
                        : "bg-slate-500 text-white"
                      : "border border-slate-700 bg-[#0B1522] text-slate-300"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <textarea
              value={currentAnswer.notes}
              onChange={(e) => updateAnswer("notes", e.target.value)}
              placeholder="Notes optional"
              className="mt-5 min-h-[110px] w-full rounded-2xl border border-slate-700 bg-[#0B1522] p-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#00A3FF]"
            />

            <div className="mt-4">
              <label className="block cursor-pointer rounded-2xl border border-[#16BFFF]/40 bg-[#16BFFF]/10 py-4 text-center text-sm font-semibold text-[#16BFFF]">
                Take / Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => uploadPhoto(e.target.files?.[0] || null)}
                />
              </label>

              {currentAnswer.photo_url && (
                <a
                  href={currentAnswer.photo_url}
                  target="_blank"
                  className="mt-3 block text-sm text-green-400 underline"
                >
                  View Uploaded Photo
                </a>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={previousQuestion}
                disabled={currentIndex === 0}
                className="flex-1 rounded-xl border border-slate-700 bg-[#0B1522] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                Previous
              </button>

              {currentIndex < filteredQuestions.length - 1 ? (
                <button
                  onClick={nextQuestion}
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-4 py-3 text-sm font-semibold text-white"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={submitDVIR}
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit DVIR"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-500">
            No DVIR questions found.
          </div>
        )}
      </div>
    </div>
  );
}
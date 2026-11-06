"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  LoaderCircle,
  Truck as TruckIcon,
  X,
} from "lucide-react";

import Navbar from "@/app/components/Navbar";
import {
  openLoadDocument,
  privateDocumentReference,
} from "@/app/lib/loadDocuments";
import { supabase } from "@/app/lib/supabase";

type Question = {
  id: string;
  category: string;
  question: string;
  vehicle_type: string;
  sort_order: number;
  requires_photo?: boolean | null;
};

type Truck = {
  id: string;
  truck_number: string;
  active: boolean;
  vehicle_type?: string | null;
};

type Answer = {
  status: "Pass" | "Fail" | "N/A" | "";
  notes: string;
  photo_url: string;
};

const emptyAnswer: Answer = { status: "", notes: "", photo_url: "" };
const maxPhotoBytes = 10 * 1024 * 1024;
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function DriverDVIRWorkspace() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState("");
  const [truckId, setTruckId] = useState("");
  const [mileage, setMileage] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadInspectionData() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      const [questionsResult, trucksResult, driverResult] = await Promise.all([
        supabase
          .from("dvir_questions")
          .select("id,category,question,vehicle_type,sort_order,requires_photo")
          .eq("active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("trucks")
          .select("id,truck_number,active,vehicle_type")
          .eq("active", true)
          .order("truck_number", { ascending: true }),
        user?.email
          ? supabase
              .from("drivers")
              .select("id")
              .eq("email", user.email)
              .eq("active", true)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (!active) return;

      const messages = [
        userError?.message,
        questionsResult.error?.message,
        trucksResult.error?.message,
        driverResult.error?.message,
      ].filter(Boolean);

      setSessionEmail(user?.email ?? "");
      setQuestions((questionsResult.data ?? []) as Question[]);
      setTrucks((trucksResult.data ?? []) as Truck[]);
      setDriverId(driverResult.data?.id ?? null);
      setError(messages.join(" "));
      setLoading(false);
    }

    void loadInspectionData();
    return () => {
      active = false;
    };
  }, []);

  const selectedTruck = trucks.find((truck) => truck.id === truckId) ?? null;
  const filteredQuestions = useMemo(() => {
    const vehicleType = selectedTruck?.vehicle_type || "all";
    return questions.filter(
      (question) =>
        question.vehicle_type === "all" ||
        question.vehicle_type === vehicleType
    );
  }, [questions, selectedTruck]);

  const currentQuestion = filteredQuestions[currentIndex];
  const currentAnswer = currentQuestion
    ? answers[currentQuestion.id] ?? emptyAnswer
    : emptyAnswer;
  const answeredCount = filteredQuestions.filter(
    (question) => answers[question.id]?.status
  ).length;
  const failedCount = filteredQuestions.filter(
    (question) => answers[question.id]?.status === "Fail"
  ).length;
  const progress = filteredQuestions.length
    ? Math.round((answeredCount / filteredQuestions.length) * 100)
    : 0;
  const setupComplete = Boolean(truckId && validMileage(mileage));

  function selectTruck(value: string) {
    if (value !== truckId && Object.keys(answers).length > 0) {
      const confirmed = window.confirm(
        "Changing trucks clears the inspection answers. Continue?"
      );
      if (!confirmed) return;
    }

    setTruckId(value);
    setAnswers({});
    setCurrentIndex(0);
    setSuccess(false);
    setError("");
  }

  function updateAnswer(field: keyof Answer, value: string) {
    if (!currentQuestion) return;
    setAnswers((current) => ({
      ...current,
      [currentQuestion.id]: {
        ...(current[currentQuestion.id] ?? emptyAnswer),
        [field]: value,
      },
    }));
    setError("");
  }

  async function uploadPhoto(file: File | null) {
    if (!file || !currentQuestion || !truckId) return;

    if (!driverId) {
      setError(
        "This account is not linked to an active driver, so inspection photos cannot be uploaded."
      );
      return;
    }

    if (!allowedPhotoTypes.has(file.type)) {
      setError("Inspection photos must be JPG, PNG, or WebP files.");
      return;
    }
    if (file.size > maxPhotoBytes) {
      setError("Inspection photos must be 10 MB or smaller.");
      return;
    }

    setUploadingPhoto(true);
    setError("");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `dvir/${truckId}/${currentQuestion.id}-${file.lastModified}-${file.size}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      setError(uploadError.message);
      setUploadingPhoto(false);
      return;
    }

    updateAnswer("photo_url", privateDocumentReference(filePath));
    setUploadingPhoto(false);
  }

  async function openPhoto() {
    try {
      await openLoadDocument(currentAnswer.photo_url);
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "This inspection photo could not be opened."
      );
    }
  }

  function validateCurrentQuestion() {
    if (!currentAnswer.status) {
      setError("Select Pass, Fail, or N/A before continuing.");
      return false;
    }
    if (currentAnswer.status === "Fail" && !currentAnswer.notes.trim()) {
      setError("Add a short note explaining the failed item.");
      return false;
    }
    if (currentQuestion?.requires_photo && !currentAnswer.photo_url) {
      setError("This inspection item requires a photo.");
      return false;
    }
    return true;
  }

  function nextQuestion() {
    if (!validateCurrentQuestion()) return;
    if (currentIndex < filteredQuestions.length - 1) {
      setCurrentIndex((index) => index + 1);
    }
  }

  async function submitDVIR() {
    if (!driverId) {
      setError(
        "This account is not linked to an active driver. Ask an owner or manager to connect the driver profile before submitting a DVIR."
      );
      return;
    }

    if (!truckId) {
      setError("Select a truck before submitting.");
      return;
    }
    if (!validMileage(mileage)) {
      setError("Enter a whole-number mileage greater than zero.");
      return;
    }

    const invalidQuestion = filteredQuestions.find((question) => {
      const answer = answers[question.id];
      return (
        !answer?.status ||
        (answer.status === "Fail" && !answer.notes.trim()) ||
        (question.requires_photo && !answer.photo_url)
      );
    });

    if (invalidQuestion) {
      setCurrentIndex(filteredQuestions.indexOf(invalidQuestion));
      const answer = answers[invalidQuestion.id];
      setError(
        !answer?.status
          ? "Complete every inspection item before submitting."
          : answer.status === "Fail" && !answer.notes.trim()
            ? "Every failed item needs a short note."
            : "A required inspection photo is missing."
      );
      return;
    }

    if (
      !window.confirm(
        `Submit this DVIR with ${failedCount} failed item${failedCount === 1 ? "" : "s"}?`
      )
    ) {
      return;
    }

    setSubmitting(true);
    setError("");
    const rows = filteredQuestions.map((question) => ({
      driver_id: driverId,
      truck_id: truckId,
      mileage: Number(mileage),
      category: question.category,
      question: question.question,
      status: answers[question.id].status,
      notes: answers[question.id].notes.trim(),
      photo_url: answers[question.id].photo_url,
    }));

    const { error: submitError } = await supabase.from("dvirs").insert(rows);
    setSubmitting(false);

    if (submitError) {
      setError(submitError.message);
      return;
    }
    setSuccess(true);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
          <div role="status" aria-live="polite" className="text-center">
          <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-cyan-400" />
          <p className="mt-3 text-sm text-slate-400">Loading inspection…</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] p-5 text-white">
        <div className="w-full max-w-lg rounded-3xl border border-emerald-500/30 bg-[#07101d] p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <h1 className="mt-5 text-3xl font-bold">DVIR submitted</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {failedCount > 0
              ? `${failedCount} failed item${failedCount === 1 ? "" : "s"} will appear in Safety and Maintenance for follow-up.`
              : "All inspection items passed or were marked not applicable."}
          </p>
          <Link
            href="/driver"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#1e6bff] to-[#00a3ff] px-4 py-3 text-sm font-bold"
          >
            Return to My Loads
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] px-3 py-4 text-white sm:px-6 sm:py-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <Navbar />

        <header className="rounded-3xl border border-cyan-500/20 bg-[#07101d] p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-cyan-400">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400">
                  Driver inspection
                </p>
                <h1 className="mt-2 text-3xl font-bold">DVIR</h1>
                <p className="mt-2 text-sm text-slate-400">
                  Complete the vehicle inspection before getting on the road.
                </p>
              </div>
            </div>
            <Link
              href="/driver"
              className="rounded-xl border border-slate-700 bg-[#0b1626] p-3 text-slate-300 transition hover:border-cyan-500/40 hover:text-white"
              aria-label="Return to My Loads"
            >
              <X className="h-5 w-5" />
            </Link>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        )}

        {!driverId && (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <div>
                <h2 className="font-bold">Review-only mode</h2>
                <p className="mt-1 text-sm leading-6 text-amber-100/80">
                  {sessionEmail
                    ? `${sessionEmail} is not linked to an active driver record.`
                    : "The signed-in account could not be matched to an active driver record."}{" "}
                  You can review the inspection flow, but photos and submissions are disabled so every DVIR keeps valid driver ownership.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-slate-800 bg-[#07101d] p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Truck
              </span>
              <select
                value={truckId}
                onChange={(event) => selectTruck(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-[#0b1626] p-3 text-sm text-white outline-none focus:border-cyan-500"
              >
                <option value="">Select truck</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>
                    Truck {truck.truck_number}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Current mileage
              </span>
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={mileage}
                onChange={(event) => {
                  setMileage(event.target.value);
                  setError("");
                }}
                placeholder="Enter odometer"
                className="w-full rounded-xl border border-slate-700 bg-[#0b1626] p-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500"
              />
            </label>
          </div>

          {selectedTruck && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-200">
              <TruckIcon className="h-4 w-4" />
              Inspection list: {formatVehicleType(selectedTruck.vehicle_type)}
            </div>
          )}
        </section>

        {!setupComplete ? (
          <section className="rounded-3xl border border-dashed border-slate-700 bg-[#07101d] p-10 text-center">
            <TruckIcon className="mx-auto h-8 w-8 text-slate-600" />
            <h2 className="mt-4 text-lg font-bold">Choose a truck and mileage</h2>
            <p className="mt-2 text-sm text-slate-500">
              The correct inspection questions will load for that vehicle type.
            </p>
          </section>
        ) : currentQuestion ? (
          <section className="rounded-3xl border border-slate-800 bg-[#07101d] p-5 shadow-[0_0_30px_rgba(0,0,0,0.3)] sm:p-7">
            <div className="flex items-center justify-between gap-4 text-xs font-semibold text-slate-400">
              <span>
                Item {currentIndex + 1} of {filteredQuestions.length}
              </span>
              <span>{answeredCount} answered</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#0b1626]">
              <div
                role="progressbar"
                aria-label="Inspection completion"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="h-full rounded-full bg-cyan-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-cyan-400">
              {currentQuestion.category}
            </p>
            <h2 className="mt-3 text-2xl font-bold leading-tight">
              {currentQuestion.question}
            </h2>
            {currentQuestion.requires_photo && (
              <p className="mt-2 text-xs font-semibold text-amber-300">
                Photo required for this item
              </p>
            )}

            <div className="mt-6 grid grid-cols-3 gap-3">
              {(["Pass", "Fail", "N/A"] as Answer["status"][]).map(
                (status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => updateAnswer("status", status)}
                    aria-pressed={currentAnswer.status === status}
                    className={`flex items-center justify-center gap-1 rounded-2xl border py-4 text-sm font-bold transition ${statusButtonClass(
                      status,
                      currentAnswer.status
                    )}`}
                  >
                    {status === "Pass" && <Check className="h-4 w-4" />}
                    {status === "Fail" && <X className="h-4 w-4" />}
                    {status}
                  </button>
                )
              )}
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Notes {currentAnswer.status === "Fail" ? "(required)" : "(optional)"}
              </span>
              <textarea
                value={currentAnswer.notes}
                onChange={(event) => updateAnswer("notes", event.target.value)}
                placeholder={
                  currentAnswer.status === "Fail"
                    ? "Describe the defect or unsafe condition"
                    : "Add inspection notes"
                }
                className="min-h-28 w-full rounded-2xl border border-slate-700 bg-[#0b1626] p-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500"
              />
            </label>

            <div className="mt-4">
              <label
                className={`flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 py-4 text-sm font-bold text-cyan-300 ${
                  driverId && !uploadingPhoto
                    ? "cursor-pointer"
                    : "cursor-not-allowed opacity-50"
                }`}
              >
                {uploadingPhoto ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {uploadingPhoto
                  ? "Uploading photo…"
                  : currentAnswer.photo_url
                    ? "Replace photo"
                    : "Take or upload photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  disabled={uploadingPhoto || !driverId}
                  className="hidden"
                  onChange={(event) => void handlePhotoChange(event, uploadPhoto)}
                />
              </label>
              {currentAnswer.photo_url && (
                <button
                  type="button"
                  onClick={() => void openPhoto()}
                  className="mt-3 w-full text-center text-xs font-bold text-emerald-300"
                >
                  Photo attached · View
                </button>
              )}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                disabled={currentIndex === 0}
                className="flex items-center justify-center gap-1 rounded-xl border border-slate-700 bg-[#0b1626] px-4 py-3 text-sm font-bold disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>

              {currentIndex < filteredQuestions.length - 1 ? (
                <button
                  type="button"
                  onClick={nextQuestion}
                  className="flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-[#1e6bff] to-[#00a3ff] px-4 py-3 text-sm font-bold"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void submitDVIR()}
                  disabled={submitting || uploadingPhoto || !driverId}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold disabled:opacity-50"
                >
                  {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {submitting ? "Submitting…" : "Submit DVIR"}
                </button>
              )}
            </div>

            {failedCount > 0 && (
              <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center text-xs font-semibold text-red-200">
                {failedCount} failed item{failedCount === 1 ? "" : "s"} will be
                sent to Safety and Maintenance for follow-up.
              </p>
            )}
          </section>
        ) : (
          <section className="rounded-3xl border border-dashed border-slate-700 bg-[#07101d] p-10 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-amber-400" />
            <h2 className="mt-4 text-lg font-bold">No inspection questions found</h2>
            <p className="mt-2 text-sm text-slate-500">
              Ask Safety to configure questions for this vehicle type.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

async function handlePhotoChange(
  event: ChangeEvent<HTMLInputElement>,
  uploadPhoto: (file: File | null) => Promise<void>
) {
  await uploadPhoto(event.target.files?.[0] ?? null);
  event.target.value = "";
}

function validMileage(value: string) {
  const mileage = Number(value);
  return Number.isInteger(mileage) && mileage > 0;
}

function formatVehicleType(value?: string | null) {
  if (!value || value === "all") return "General vehicle";
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function statusButtonClass(status: Answer["status"], current: Answer["status"]) {
  if (status !== current) {
    return "border-slate-700 bg-[#0b1626] text-slate-300";
  }
  if (status === "Pass") {
    return "border-emerald-500 bg-emerald-600 text-white";
  }
  if (status === "Fail") {
    return "border-red-500 bg-red-600 text-white";
  }
  return "border-slate-500 bg-slate-600 text-white";
}

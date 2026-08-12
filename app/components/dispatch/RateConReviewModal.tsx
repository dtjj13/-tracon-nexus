export type RateConReviewData = {
  broker_name: string;
  broker_load_id: string;
  pickup: string;
  dropoff: string;
  rate: string;
  loaded_miles: string;
  bol_number: string;
};

type RateConReviewModalProps = {
  data: RateConReviewData | null;
  fileName?: string;
  onChange: (data: RateConReviewData) => void;
  onCancel: () => void;
  onApprove: (data: RateConReviewData) => void;
};

export default function RateConReviewModal({
  data,
  fileName,
  onChange,
  onCancel,
  onApprove,
}: RateConReviewModalProps) {
  if (!data) return null;

  const requiredFieldsComplete = Boolean(
    data.pickup.trim() && data.dropoff.trim() && data.rate.trim()
  );

  const updateField = (
    field: keyof RateConReviewData,
    value: string
  ) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rate-con-review-title"
    >
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-purple-500/30 bg-[#07101A] shadow-[0_0_60px_rgba(147,51,234,0.22)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800 bg-[#07101A]/95 p-5 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-300">
              AI Rate Con Review
            </p>

            <h2
              id="rate-con-review-title"
              className="mt-2 text-2xl font-bold text-white"
            >
              Confirm scanned details
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Check every value before adding it to the Create Load form.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Close rate confirmation review"
            className="rounded-xl border border-slate-700 px-3 py-2 text-slate-400 transition hover:border-slate-500 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex flex-col gap-3 rounded-xl border border-purple-500/20 bg-purple-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Source document
              </p>

              <p className="mt-1 break-all text-sm font-medium text-white">
                {fileName || "Uploaded rate confirmation"}
              </p>
            </div>

            <span
              className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
                requiredFieldsComplete
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              {requiredFieldsComplete
                ? "Required fields found"
                : "Review required fields"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReviewField
              label="Broker name"
              value={data.broker_name}
              onChange={(value) =>
                updateField("broker_name", value)
              }
              placeholder="Broker or customer"
            />

            <ReviewField
              label="Broker load ID"
              value={data.broker_load_id}
              onChange={(value) =>
                updateField("broker_load_id", value)
              }
              placeholder="Load or confirmation number"
            />

            <ReviewField
              label="Pickup"
              value={data.pickup}
              onChange={(value) =>
                updateField("pickup", value)
              }
              placeholder="Pickup city, state, or address"
              required
            />

            <ReviewField
              label="Dropoff"
              value={data.dropoff}
              onChange={(value) =>
                updateField("dropoff", value)
              }
              placeholder="Dropoff city, state, or address"
              required
            />

            <ReviewField
              label="Load revenue"
              value={data.rate}
              onChange={(value) =>
                updateField("rate", value)
              }
              placeholder="0.00"
              prefix="$"
              inputMode="decimal"
              required
            />

            <ReviewField
              label="Loaded miles"
              value={data.loaded_miles}
              onChange={(value) =>
                updateField("loaded_miles", value)
              }
             placeholder="Not provided — enter manually"
              suffix="mi"
              inputMode="decimal"
            />

            <ReviewField
              label="BOL number"
              value={data.bol_number}
              onChange={(value) =>
                updateField("bol_number", value)
              }
              placeholder="Optional"
            />
          </div>

          {!requiredFieldsComplete && (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Pickup, dropoff, and load revenue must be confirmed
              before these values can be used.
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Cancel Scan
            </button>

            <button
              type="button"
              onClick={() => onApprove(data)}
              disabled={!requiredFieldsComplete}
              className="rounded-xl bg-gradient-to-r from-purple-600 to-[#1E6BFF] px-5 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(147,51,234,0.3)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Approve &amp; Use Values
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewField({
  label,
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
  inputMode = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  prefix?: string;
  suffix?: string;
  inputMode?: "text" | "decimal" | "numeric";
  required?: boolean;
}) {
  return (
    <label className="block rounded-xl border border-slate-800 bg-[#050A11] p-4 transition focus-within:border-purple-500/60">
      <span className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-200">
        {label}

        {required && (
          <span className="text-[10px] uppercase tracking-widest text-purple-300">
            Required
          </span>
        )}
      </span>

      <span className="mt-3 flex items-center rounded-xl border border-slate-700 bg-[#0B1522] px-3 focus-within:border-[#00A3FF]">
        {prefix && (
          <span className="mr-2 text-slate-500">
            {prefix}
          </span>
        )}

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-600"
        />

        {suffix && (
          <span className="ml-2 text-xs text-slate-500">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}
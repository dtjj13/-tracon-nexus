import ComplianceDocumentForm from "@/app/components/safety/ComplianceDocumentForm";
import ComplianceCenter from "@/app/components/safety/ComplianceCenter";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  FileWarning,
  ShieldCheck,
  Truck,
  UserRoundCheck,
} from "lucide-react";

const summaryCards = [
  {
    label: "Open alerts",
    value: "0",
    color: "text-green-400",
  },
  {
    label: "Expiring soon",
    value: "0",
    color: "text-white",
  },
  {
    label: "Driver files",
    value: "0",
    color: "text-white",
  },
  {
    label: "Equipment files",
    value: "0",
    color: "text-white",
  },
];

const complianceSections = [
  {
    title: "Driver compliance",
    description: "Monitor the documents required to keep every driver qualified.",
    icon: UserRoundCheck,
    items: [
      "Commercial driver license",
      "Medical certificate",
      "Motor vehicle record",
      "Drug and alcohol program",
    ],
  },
  {
    title: "Fleet compliance",
    description: "Track documents and inspections required for trucks and equipment.",
    icon: Truck,
    items: [
      "Vehicle registration",
      "Insurance documents",
      "Annual inspections",
      "Maintenance records",
    ],
  },
];

export default function SafetyPage() {
  return (
    <main className="min-h-screen bg-[#020617] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="rounded-3xl border border-cyan-500/20 bg-[#07101d] p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-cyan-400">
                <ShieldCheck className="h-7 w-7" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400">
                  Safety operations
                </p>

                <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                  Safety &amp; Compliance
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                  Keep driver qualifications, vehicle documents, inspections,
                  and expiration alerts organized in one place.
                </p>
              </div>
            </div>

            <Link
              href="/owner"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#0b1626] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-500/40 hover:text-cyan-400"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Owner
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-800 bg-[#07101d] p-5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {card.label}
              </p>

              <p className={`mt-3 text-3xl font-bold ${card.color}`}>
                {card.value}
              </p>
            </div>
          ))}
        </section>
<ComplianceCenter />
<ComplianceDocumentForm />
        <section className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.06] p-6">
          <div className="flex items-start gap-3">
            <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />

            <div>
              <h2 className="font-semibold text-amber-300">
                Compliance records are not connected yet
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                This page is ready for driver documents, truck documents,
                expiration dates, and automatic safety alerts. No compliance
                status will be assumed until those records are connected.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {complianceSections.map((section) => {
            const Icon = section.icon;

            return (
              <article
                key={section.title}
                className="rounded-3xl border border-slate-800 bg-[#07101d] p-6"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2.5 text-cyan-400">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-xl font-bold">{section.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {section.description}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {section.items.map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#0a1422] px-4 py-3"
                    >
                      <span className="text-sm font-medium text-slate-200">
                        {item}
                      </span>

                      <span className="shrink-0 rounded-full border border-slate-700 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Not connected
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-3xl border border-cyan-500/20 bg-[#07101d] p-6">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />

            <div>
              <h2 className="font-semibold">Next safety upgrade</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                We’ll connect expiration dates and create automatic warnings
                for documents that are missing, expired, or approaching
                renewal.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
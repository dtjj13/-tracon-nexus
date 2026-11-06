import ComplianceDocumentForm from "@/app/components/safety/ComplianceDocumentForm";
import ComplianceCenter from "@/app/components/safety/ComplianceCenter";
import Navbar from "@/app/components/Navbar";
import RoleGate from "@/app/components/RoleGate";
import Link from "next/link";
import {
  ArrowLeft,
  BellRing,
  ClipboardCheck,
  ShieldCheck,
  Wrench,
} from "lucide-react";

const safetyWorkflow = [
  {
    title: "Record",
    description: "Upload driver and truck documents with the dates needed for monitoring.",
    icon: ClipboardCheck,
  },
  {
    title: "Review",
    description: "Work expired documents, upcoming renewals, and failed inspections from one queue.",
    icon: BellRing,
  },
  {
    title: "Resolve",
    description: "Send defects into maintenance and replace documents when corrective work is complete.",
    icon: Wrench,
  },
];

export default function SafetyPage() {
  return (
    <RoleGate allowed={["owner", "admin", "manager", "safety"]}>
      <main className="min-h-screen bg-[#020617] px-4 py-6 text-white sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1500px] space-y-6">
          <Navbar />
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
                    Monitor driver qualifications, vehicle documents,
                    expiration alerts, and failed inspections from one
                    operational queue.
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

          <ComplianceCenter />
          <ComplianceDocumentForm />

          <section
            aria-labelledby="safety-workflow-title"
            className="space-y-4"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">
                Operating rhythm
              </p>
              <h2 id="safety-workflow-title" className="mt-2 text-2xl font-bold">
                A clear path from record to resolution
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {safetyWorkflow.map((step, index) => {
                const Icon = step.icon;

                return (
                  <article
                    key={step.title}
                    className="rounded-2xl border border-slate-800 bg-[#07101d] p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2.5 text-cyan-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {step.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </RoleGate>
  );
}

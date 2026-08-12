import {
  CheckCircle2,
  FileCheck2,
  FileWarning,
  PackageCheck,
  Truck,
  UserRoundCheck,
} from "lucide-react";

type Load = {
  id: string;
  tracon_id?: string;
  broker_load_id?: string;
  driver_name?: string;
  status?: string;
  pod_url?: string;
  rate_con_url?: string;
  created_at?: string;
  delivered_at?: string;
};

type TimelineEvent = {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  icon: typeof Truck;
  iconColor: string;
};

type Props = {
  loads: Load[];
};

export default function ExecutiveTimeline({ loads }: Props) {
  const events = buildTimelineEvents(loads).slice(0, 10);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#07101A]">
      <div className="flex flex-col gap-2 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#16BFFF]">
            Recent Activity
          </p>

          <h2 className="mt-1 text-lg font-semibold text-white">
            Executive Timeline
          </h2>
        </div>

        <p className="text-sm text-slate-500">
          Latest company activity
        </p>
      </div>

      <div className="divide-y divide-slate-800">
        {events.map((event) => {
          const Icon = event.icon;

          return (
            <div
              key={event.id}
              className="flex gap-4 p-5 transition hover:bg-[#0B1522]"
            >
              <div className="flex flex-col items-center">
                <div className="rounded-xl border border-slate-800 bg-[#09111C] p-2.5">
                  <Icon className={`h-5 w-5 ${event.iconColor}`} />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-white">
                      {event.title}
                    </p>

                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {event.description}
                    </p>
                  </div>

                  <time className="shrink-0 text-xs text-slate-500">
                    {formatTimelineDate(event.timestamp)}
                  </time>
                </div>
              </div>
            </div>
          );
        })}

        {events.length === 0 && (
          <div className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-slate-600" />

            <p className="mt-3 text-sm text-slate-500">
              No company activity is available for this period.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function buildTimelineEvents(loads: Load[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  loads.forEach((load) => {
    const loadNumber =
      load.broker_load_id || load.tracon_id || "Unnumbered Load";

    if (load.created_at) {
      events.push({
        id: `${load.id}-created`,
        title: "Load Created",
        description: `${loadNumber} was added to dispatch.`,
        timestamp: new Date(load.created_at),
        icon: Truck,
        iconColor: "text-[#16BFFF]",
      });
    }

    if (load.driver_name) {
      events.push({
        id: `${load.id}-driver`,
        title: "Driver Assigned",
        description: `${load.driver_name} is assigned to ${loadNumber}.`,
        timestamp: new Date(load.created_at || Date.now()),
        icon: UserRoundCheck,
        iconColor: "text-indigo-400",
      });
    }

    if (load.rate_con_url) {
      events.push({
        id: `${load.id}-rate-con`,
        title: "Rate Confirmation Available",
        description: `${loadNumber} has a rate confirmation attached.`,
        timestamp: new Date(load.created_at || Date.now()),
        icon: FileCheck2,
        iconColor: "text-yellow-400",
      });
    }

    if (load.pod_url) {
      events.push({
        id: `${load.id}-pod`,
        title: "POD Uploaded",
        description: `Proof of delivery was uploaded for ${loadNumber}.`,
        timestamp: new Date(
          load.delivered_at || load.created_at || Date.now()
        ),
        icon: PackageCheck,
        iconColor: "text-green-400",
      });
    }

    if (
      clean(load.status) === "delivered" &&
      !load.pod_url
    ) {
      events.push({
        id: `${load.id}-pod-missing`,
        title: "Missing POD Alert",
        description: `${loadNumber} is delivered but still needs a POD.`,
        timestamp: new Date(
          load.delivered_at || load.created_at || Date.now()
        ),
        icon: FileWarning,
        iconColor: "text-red-400",
      });
    }

    if (load.delivered_at) {
      events.push({
        id: `${load.id}-delivered`,
        title: "Load Delivered",
        description: `${loadNumber} was marked delivered.`,
        timestamp: new Date(load.delivered_at),
        icon: CheckCircle2,
        iconColor: "text-green-400",
      });
    }
  });

  return events
    .filter((event) => !Number.isNaN(event.timestamp.getTime()))
    .sort(
      (a, b) =>
        b.timestamp.getTime() - a.timestamp.getTime()
    );
}

function formatTimelineDate(date: Date) {
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function clean(value?: string) {
  return value?.trim().toLowerCase() || "";
}
import Navbar from "../components/Navbar";
import RoleGate from "../components/RoleGate";
import TraconMapsWorkspace from "../components/maps/TraconMapsWorkspace";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function TraconMapsPage({
  searchParams,
}: {
  searchParams: Promise<{
    pickup?: string | string[];
    dropoff?: string | string[];
  }>;
}) {
  const query = await searchParams;

  return (
    <RoleGate allowed={["owner", "admin", "dispatcher", "manager"]}>
      <main className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
        <div className="mx-auto max-w-[1600px]">
          <Navbar />
          <TraconMapsWorkspace
            initialPickup={firstValue(query.pickup)}
            initialDropoff={firstValue(query.dropoff)}
          />
        </div>
      </main>
    </RoleGate>
  );
}

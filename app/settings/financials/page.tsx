import Navbar from "@/app/components/Navbar";
import RoleGate from "@/app/components/RoleGate";
import FinancialSettings from "@/app/components/owner/FinancialSettings";

export default function FinancialSettingsPage() {
  return (
    <RoleGate allowed={["owner", "admin"]}>
      <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
        <div className="mx-auto w-full max-w-[1500px]">
          <Navbar />
          <FinancialSettings />
        </div>
      </div>
    </RoleGate>
  );
}

import Navbar from "@/app/components/Navbar";
import FinancialSettings from "@/app/components/owner/FinancialSettings";

export default function FinancialSettingsPage() {
  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="mx-auto w-full max-w-[1500px]">
        <Navbar />
        <FinancialSettings />
      </div>
    </div>
  );
}

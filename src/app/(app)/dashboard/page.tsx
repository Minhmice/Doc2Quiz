import { DashboardLibraryClient } from "@/components/dashboard/DashboardLibraryClient";
import { DashboardStatsWidget } from "@/components/dashboard/DashboardStatsWidget";

export default function DashboardPage() {
  return (
    <div>
      <DashboardStatsWidget />
      <DashboardLibraryClient />
    </div>
  );
}

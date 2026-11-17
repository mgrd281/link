"use client";

import { Button } from "@linkyo/ui";
import { LayoutDashboard, Smartphone } from "lucide-react";

import { Link } from "@/i18n/navigation";

import type { DirectionId } from "./registry";

export function DirectionLinks({ direction, pageLabel, dashboardLabel }: { direction: DirectionId; pageLabel: string; dashboardLabel: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="primary" icon={Smartphone}>
        <Link href={`/directions/${direction}`}>{pageLabel}</Link>
      </Button>
      <Button asChild icon={LayoutDashboard}>
        <Link href={`/directions/${direction}/dashboard`}>{dashboardLabel}</Link>
      </Button>
    </div>
  );
}

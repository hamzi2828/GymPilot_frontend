"use client";

import Link from "next/link";
import { PageHeader } from "../../admin/_shared/ui";
import GymsTable from "./GymsTable";

export default function SuperAdminGymsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Gyms"
        actions={
          <Link
            href="/super-admin/gyms/new"
            className="inline-flex h-9 items-center rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            New gym
          </Link>
        }
      />
      <GymsTable />
    </>
  );
}

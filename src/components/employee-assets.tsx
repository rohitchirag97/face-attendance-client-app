import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import AssetHoldings from "@/components/asset-holdings";
import { ErrorText, Spinner } from "@/components/form-kit";
import { employeeAssetsQuery } from "@/hooks/use-assets";

/** An employee's assets on their profile; handovers happen on the Assets page. */
const EmployeeAssets: React.FC<{ organizationId: string; employeeId: string }> = ({ organizationId, employeeId }) => {
  const { data, isLoading, error } = useQuery(employeeAssetsQuery(organizationId, employeeId));
  if (isLoading) return <Spinner />;
  if (!data) return <ErrorText message={error?.message ?? "Could not load assets."} />;
  return (
    <section className="space-y-4 rounded-xl border p-5 sm:p-6">
      <AssetHoldings data={data} />
      <Link to="/assets" className="inline-block text-sm font-medium text-primary hover:underline">Hand over or take back assets</Link>
    </section>
  );
};

export default EmployeeAssets;

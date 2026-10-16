import React from "react";
import { useQuery } from "@tanstack/react-query";
import AssetHoldings from "@/components/asset-holdings";
import { ErrorText, PageHeader, Spinner } from "@/components/form-kit";
import { myAssetsQuery, useAcknowledgeAsset } from "@/hooks/use-assets";
import { getActiveOrganizationId } from "@/lib/session";

/** Company assets the signed-in employee holds; they confirm receipt here. */
const MyAssetsPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const { data, isLoading, error } = useQuery(myAssetsQuery(organizationId));
  const acknowledge = useAcknowledgeAsset(organizationId);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader title="My assets" description="Company property handed to you. Confirm what you received; return everything when you leave." />
      {isLoading ? (
        <Spinner />
      ) : !data ? (
        <ErrorText message={error?.message ?? "Could not load your assets."} />
      ) : (
        <>
          <AssetHoldings data={data} onAcknowledge={(id) => acknowledge.mutate(id)} acknowledging={acknowledge.isPending} />
          <ErrorText message={acknowledge.error?.message ?? null} />
        </>
      )}
    </div>
  );
};

export default MyAssetsPage;

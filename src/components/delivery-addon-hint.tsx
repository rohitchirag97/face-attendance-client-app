import React from "react";
import { Link } from "react-router";
import { hasManagerRole } from "@/lib/session";

/** For owners and admins when sending is off: documents can still be printed and downloaded. */
const DeliveryAddonHint: React.FC<{ addon: boolean }> = ({ addon }) =>
  addon || !hasManagerRole() ? null : (
    <p className="text-xs text-muted-foreground print:hidden">
      Sending by email or WhatsApp is an add-on.{" "}
      <Link to="/messaging" className="font-medium text-primary hover:underline">Turn it on</Link>
    </p>
  );

export default DeliveryAddonHint;

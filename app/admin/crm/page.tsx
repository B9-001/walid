"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import PipelineBoard from "@/components/diamond/admin/PipelineBoard";
import CustomersTable from "@/components/diamond/admin/CustomersTable";
import EmailDashboard from "@/components/diamond/admin/EmailDashboard";

// Email is now fully automated through Resend (triggered flows + scheduled tier broadcasts),
// so the old manual Marketing/Campaigns editors are gone. The Email tab is the live window.
const TABS = [
  { id: "pipeline", label: "Pipeline" },
  { id: "customers", label: "Customers" },
  { id: "email", label: "Email" },
];

export default function AdminCRMPage() {
  const [tab, setTab] = useState("pipeline");
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const resync = async () => {
    setSyncing(true); setSyncMsg("");
    const { data, error } = await supabase.rpc("diamond_resync_crm");
    setSyncing(false);
    if (error) { setSyncMsg(error.message); return; }
    setSyncMsg(`✓ Synced${data?.added ? ` — added ${data.added} customer${data.added === 1 ? "" : "s"}` : ""}.`);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div>
      <div className="border-b border-brand-line pb-7 mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl md:text-6xl text-brand-dark leading-none">CRM</h1>
          <p className="font-script text-2xl text-brand-primary mt-2">customers, pipeline &amp; email</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1.5">
          <button
            onClick={resync}
            disabled={syncing}
            title="Pull in customers from orders, clear tags they've grown out of, and re-tag everyone"
            className="border border-brand-primary text-brand-primary px-5 py-2.5 rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-brand-primary hover:text-brand-light transition-all disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "↺ Re-sync"}
          </button>
          {syncMsg && <span className={`text-[11px] ${syncMsg.startsWith("✓") ? "text-green-600" : "text-brand-primary"}`}>{syncMsg}</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 rounded-full text-[11px] font-bold tracking-widest uppercase transition-all ${
              tab === t.id ? "bg-brand-primary text-brand-light" : "border border-brand-line text-brand-dark/60 hover:border-brand-primary hover:text-brand-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pipeline" && <PipelineBoard key={refreshKey} onEmailStage={() => setTab("email")} />}
      {tab === "customers" && <CustomersTable key={refreshKey} />}
      {tab === "email" && <EmailDashboard />}
    </div>
  );
}

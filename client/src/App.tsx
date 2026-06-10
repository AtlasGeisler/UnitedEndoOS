import { Route, Switch } from "wouter";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Login } from "@/pages/Login";
import { Patients } from "@/pages/Patients";
import { PatientChart } from "@/pages/PatientChart";
import { Clinical } from "@/pages/Clinical";
import { VisitWorkspace } from "@/pages/VisitWorkspace";
import { Today } from "@/pages/Today";
import { Schedule } from "@/pages/Schedule";
import { Worklists } from "@/pages/Worklists";
import { Referrals } from "@/pages/Referrals";
import { ReferringDoctors } from "@/pages/ReferringDoctors";
import { Plans } from "@/pages/Plans";
import { Portal } from "@/pages/Portal";
import { Billing } from "@/pages/Billing";
import { Messages } from "@/pages/Messages";
import { Kiosk } from "@/pages/Kiosk";
import { PatientPortal } from "@/pages/PatientPortal";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { MODULES } from "@/modules";

// Per-module copy for the Phase 0 empty states. Each line names what the module
// will do and which phase delivers it, so the shell is honest about progress.
const MODULE_META: Record<string, { blurb: string; phase: string }> = {
  today: {
    blurb:
      "Your morning huddle: production against goal, emergency slot status, unconfirmed patients, and unsigned notes, with an AI written brief.",
    phase: "Phase 3",
  },
  schedule: {
    blurb:
      "Day and week views with provider and operatory columns, drag and drop, and emergency slot shading from the Thanksgiving Rule.",
    phase: "Phase 3",
  },
  worklists: {
    blurb:
      "Savable task queues with inline actions: unsigned notes, unsent referral reports, unscheduled treatment, claims, and recall due.",
    phase: "Phase 3",
  },
  patients: {
    blurb:
      "The patient directory with instant search and a hover preview of each patient's latest radiograph.",
    phase: "Phase 1",
  },
  clinical: {
    blurb:
      "The Visit Workspace clinical cockpit: structured endo findings, per canal documentation, the required radiograph sequence, and an AI drafted note you approve.",
    phase: "Phase 2",
  },
  referrals: {
    blurb:
      "A kanban pipeline from received to closed, plus the intake form that mirrors the referring doctor portal.",
    phase: "Phase 4",
  },
  referring: {
    blurb:
      "The referring doctor CRM: referral history, preferences, touchpoints, and alerts when volume drops or a report SLA slips.",
    phase: "Phase 4",
  },
  plans: {
    blurb:
      "Multi option treatment plans with drag and drop sequencing, insurance estimates, and canvas e-signature capture.",
    phase: "Phase 4",
  },
  billing: {
    blurb:
      "Eligibility, claims from draft to paid, auto posted ERAs, statements, and card on file payment plans.",
    phase: "Phase 5",
  },
  messages: {
    blurb:
      "Internal threads alongside the two way patient texting inbox with a development outbox.",
    phase: "Phase 5",
  },
  analytics: {
    blurb:
      "Configurable dashboards: case completion, referrer performance, revenue projection, and the restorative follow-up tracker.",
    phase: "Phase 6",
  },
  performance: {
    blurb:
      "Provider production, case mix, chair time utilization, report turnaround, and emergency acceptance rate.",
    phase: "Phase 6",
  },
  operations: {
    blurb:
      "Staff and roles, locations, Thanksgiving Rule settings, CRM alert rules, and the report delivery log.",
    phase: "Phase 6",
  },
  admin: {
    blurb:
      "Config categories, the AI prompt manager, prediction weights, and the AI audit log viewer with PHI redaction badges.",
    phase: "Phase 6",
  },
};

export function App() {
  const { user, isLoading } = useAuth();

  // Public surfaces render outside the app shell and the auth gate: the referring
  // doctor portal, the office kiosk, and the read-only patient portal.
  if (location.pathname.startsWith("/portal")) return <Portal />;
  if (location.pathname.startsWith("/kiosk")) return <Kiosk />;
  if (location.pathname.startsWith("/my")) return <PatientPortal />;

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas text-content-soft">
        <div className="animate-pulse text-[13px]">Loading UnitedEndoOS...</div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <AppShell>
      <Switch>
        {/* Phase 1 real pages take precedence over the placeholder routes. */}
        <Route path="/patients" component={Patients} />
        <Route path="/patients/:id" component={PatientChart} />
        <Route path="/clinical" component={Clinical} />
        <Route path="/visits/:id" component={VisitWorkspace} />
        <Route path="/" component={Today} />
        <Route path="/schedule" component={Schedule} />
        <Route path="/worklists" component={Worklists} />
        <Route path="/referrals" component={Referrals} />
        <Route path="/referring-doctors" component={ReferringDoctors} />
        <Route path="/plans" component={Plans} />
        <Route path="/billing" component={Billing} />
        <Route path="/messages" component={Messages} />
        {MODULES.filter((m) => !["patients", "clinical", "today", "schedule", "worklists", "referrals", "referring", "plans", "billing", "messages"].includes(m.key)).map((m) => {
          const meta = MODULE_META[m.key];
          return (
            <Route key={m.key} path={m.path}>
              <PlaceholderPage
                icon={m.icon}
                title={m.label}
                blurb={meta?.blurb ?? "Coming soon."}
                phase={meta?.phase ?? "a later phase"}
              />
            </Route>
          );
        })}
        <Route>
          <PlaceholderPage
            icon={MODULES[0].icon}
            title="Not found"
            blurb="That page does not exist yet. Use Cmd+K to jump somewhere."
            phase="now"
          />
        </Route>
      </Switch>
    </AppShell>
  );
}

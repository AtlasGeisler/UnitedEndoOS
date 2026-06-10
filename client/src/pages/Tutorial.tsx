import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun, CalendarDays, Images, Stethoscope, Sparkles, GitPullRequestArrow,
  BarChart3, ShieldCheck, ChevronLeft, ChevronRight, Check, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  icon: LucideIcon;
  title: string;
  description: string;
  points: string[];
  to?: string;
  cta?: string;
}

// The interactive onboarding tutorial, adopted from the prototype and adapted to
// the image-first workflow. It walks a new user through the day, the chart, the
// cockpit, the AI features, the growth engine, analytics, and admin.
const STEPS: Step[] = [
  {
    icon: Sun, title: "Start your day", to: "/", cta: "Open Today",
    description: "The Today page is your morning huddle.",
    points: ["Production against goal and the day's schedule at a glance.", "Emergency slot status from the Thanksgiving Rule.", "An AI written brief and CRM alerts to act on."],
  },
  {
    icon: CalendarDays, title: "Run the schedule", to: "/schedule", cta: "Open Schedule",
    description: "Operatory columns, drag and drop, and protected emergency slots.",
    points: ["Dashed slots are held for same day emergencies.", "Front desk is blocked from a protected slot, a manager overrides with a reason.", "Import a schedule photo and the AI extracts the appointments."],
  },
  {
    icon: Images, title: "Open a chart to images", to: "/patients", cta: "Open Patients",
    description: "The chart opens to a wall of radiographs, not a form.",
    points: ["Press Space on any image for Quick Look.", "Compare two films side by side or with an opacity swipe.", "Drag a file onto the chart to import it."],
  },
  {
    icon: Stethoscope, title: "Document a visit", to: "/clinical", cta: "Open Clinical",
    description: "The Visit Workspace is the clinical cockpit.",
    points: ["Record graded findings across Findings, Diagnosis, Procedure, and Prognosis.", "Per canal documentation and the required radiograph sequence.", "Sign and lock the note, after which only addenda are allowed."],
  },
  {
    icon: Sparkles, title: "Let the AI assist", to: "/clinical", cta: "Open Clinical",
    description: "The model assists, the clinician authors and signs.",
    points: ["AI drafts the SOAP note and the referral report for your review.", "The diagnosis predictor suggests a pulpal and apical diagnosis and prognosis.", "Image analysis pins advisory findings on the radiograph. PHI is redacted before every AI call."],
  },
  {
    icon: GitPullRequestArrow, title: "Grow referrals", to: "/referring-doctors", cta: "Open Referring Doctors",
    description: "Referrals are the growth engine for an endo practice.",
    points: ["The kanban moves a referral from received to closed.", "The CRM tracks each referrer with a trend and alerts.", "A GP submits and tracks referrals through a tokenized portal."],
  },
  {
    icon: BarChart3, title: "Read the practice", to: "/analytics", cta: "Open Analytics",
    description: "Analytics and performance close the loop.",
    points: ["Revenue projection, case completion, and top referrers.", "The restorative tracker flags RCTs missing a permanent restoration.", "Provider production, chair use, and emergency acceptance."],
  },
  {
    icon: ShieldCheck, title: "Tune and govern", to: "/admin", cta: "Open Admin",
    description: "Admin holds the configuration and the safety surface.",
    points: ["Edit the AI prompts and the prediction weights.", "Every AI interaction is in the audit log with a PHI redacted badge.", "Operations holds staff, locations, and the Thanksgiving Rule settings."],
  },
];

export function Tutorial() {
  const [i, setI] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const step = STEPS[i];
  const Icon = step.icon;
  const markDone = () => setDone((d) => (d.includes(i) ? d : [...d, i]));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-hairline px-7 py-4">
        <h1 className="text-[18px] font-semibold">Welcome to UnitedEndoOS</h1>
        <div className="text-[13px] text-content-soft">A two minute tour of the workflow</div>
      </div>
      <div className="flex min-h-0 flex-1">
        {/* Step rail */}
        <div className="w-64 shrink-0 overflow-y-auto border-r border-hairline p-3">
          {STEPS.map((s, idx) => (
            <button key={idx} onClick={() => setI(idx)} className={cn("mb-1 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px]", i === idx ? "bg-endo/12 text-endo" : "hover:bg-[var(--surface-2)]")}>
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px]", done.includes(idx) ? "bg-endo text-white" : i === idx ? "border border-endo text-endo" : "border border-hairline text-content-soft")}>
                {done.includes(idx) ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </span>
              <span className="flex-1 truncate">{s.title}</span>
            </button>
          ))}
        </div>

        {/* Step detail */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-8">
            <AnimatePresence mode="wait">
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }} className="mx-auto max-w-xl">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-endo/12 text-endo"><Icon className="h-7 w-7" /></div>
                <div className="mb-1 text-[12px] font-medium uppercase tracking-wide text-content-soft">Step {i + 1} of {STEPS.length}</div>
                <h2 className="font-serif text-[24px] font-semibold">{step.title}</h2>
                <p className="mt-1 text-[15px] text-content-soft">{step.description}</p>
                <ul className="mt-4 space-y-2">
                  {step.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-[14px]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-endo" /> {p}</li>
                  ))}
                </ul>
                {step.to && (
                  <Link href={step.to}>
                    <span onClick={markDone} className="mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-endo px-3.5 py-2 text-[13px] font-medium text-white hover:bg-endo/90">
                      {step.cta} <ChevronRight className="h-4 w-4" />
                    </span>
                  </Link>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2 border-t border-hairline px-8 py-3">
            <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] text-content-soft disabled:opacity-40 hover:bg-[var(--surface-2)]"><ChevronLeft className="h-4 w-4" /> Back</button>
            <div className="mx-auto flex gap-1">
              {STEPS.map((_, idx) => <span key={idx} className={cn("h-1.5 w-1.5 rounded-full", idx === i ? "bg-endo" : "bg-hairline")} />)}
            </div>
            {i < STEPS.length - 1 ? (
              <button onClick={() => { markDone(); setI(i + 1); }} className="flex items-center gap-1 rounded-md bg-endo px-3 py-1.5 text-[13px] font-medium text-white">Next <ChevronRight className="h-4 w-4" /></button>
            ) : (
              <Link href="/"><span onClick={markDone} className="flex items-center gap-1 rounded-md bg-endo px-3 py-1.5 text-[13px] font-medium text-white">Finish <Check className="h-4 w-4" /></span></Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

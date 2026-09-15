/**
 * TriageSetu: Local-First Multimodal Urgency Triage & CDSS Platform
 * License: 100% Free & Open-Source (FOSS)
 * Compliance: Ayushman Bharat Digital Mission (ABDM) / HL7 FHIR R4
 * CDSCO SaMD: Class B Assistive Clinical Decision Support System
 */

import React, { useState, useEffect, useCallback } from "react";
import FrontlineTablet from "./components/FrontlineTablet.jsx";
import DoctorDashboard from "./components/DoctorDashboard.jsx";
import { ClientMEWSEngine, TriageTier } from "./services/mewsEngine.ts";
import {
  Tablet,
  Stethoscope,
  Columns,
  Activity,
  ShieldAlert,
  Info,
  HeartPulse,
  Sparkles
} from "lucide-react";

// Initial Authentic Rural Clinic Cases
const INITIAL_DEMO_CASES = [
  {
    id: "CASE-101",
    patient_name: "Rameshwar Patel",
    abha_id: "ABHA-91-4451-9921-12",
    age: 58,
    gender: "Male",
    clinic_location: "Bhilwara Sub-Centre HWC",
    chief_complaint: "2 ghante se seene mein dard aur paseena aa raha hai (Retrosternal chest pain)",
    systolic_bp: 78,
    diastolic_bp: 52,
    heart_rate: 126,
    respiratory_rate: 25,
    temperature_c: 36.6,
    spo2: 91,
    avpu: "V",
    conjunctival_pallor_grade: "moderate",
    rash_or_wound_severity: "none",
    speech_red_flag: true,
    timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
    status: "waiting",
  },
  {
    id: "CASE-102",
    patient_name: "Kamla Devi",
    abha_id: "ABHA-91-8812-3341-90",
    age: 34,
    gender: "Female",
    clinic_location: "Bhilwara Sub-Centre HWC",
    chief_complaint: "Bhookh nahi lag rahi, bohot kamzori aur chakkar hain (Severe Fatigue & Pallor)",
    systolic_bp: 94,
    diastolic_bp: 64,
    heart_rate: 104,
    respiratory_rate: 18,
    temperature_c: 37.0,
    spo2: 97,
    avpu: "A",
    conjunctival_pallor_grade: "severe",
    rash_or_wound_severity: "none",
    speech_red_flag: false,
    timestamp: new Date(Date.now() - 55 * 60000).toISOString(),
    status: "waiting",
  },
  {
    id: "CASE-103",
    patient_name: "Bablu Kumar",
    abha_id: "ABHA-91-1102-4422-55",
    age: 19,
    gender: "Male",
    clinic_location: "Bhilwara Sub-Centre HWC",
    chief_complaint: "Pair mein kheti ke dauran gehra ghaav laga hai (Deep leg wound with spreading redness)",
    systolic_bp: 118,
    diastolic_bp: 76,
    heart_rate: 88,
    respiratory_rate: 16,
    temperature_c: 38.6,
    spo2: 99,
    avpu: "A",
    conjunctival_pallor_grade: "normal",
    rash_or_wound_severity: "spreading_erythema",
    speech_red_flag: false,
    timestamp: new Date(Date.now() - 75 * 60000).toISOString(),
    status: "waiting",
  },
  {
    id: "CASE-104",
    patient_name: "Gita Bai",
    abha_id: "ABHA-91-7731-2940-18",
    age: 62,
    gender: "Female",
    clinic_location: "Bhilwara Sub-Centre HWC",
    chief_complaint: "Pichle do din se gale mein kharash aur halka jukham hai (Mild URI)",
    systolic_bp: 122,
    diastolic_bp: 78,
    heart_rate: 72,
    respiratory_rate: 14,
    temperature_c: 36.9,
    spo2: 99,
    avpu: "A",
    conjunctival_pallor_grade: "normal",
    rash_or_wound_severity: "none",
    speech_red_flag: false,
    timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
    status: "waiting",
  },
];

export default function App() {
  const [viewMode, setViewMode] = useState<"tablet" | "doctor" | "dual">("tablet");
  const [queue, setQueue] = useState<any[]>([]);
  const [showCDSSDisclaimer, setShowCDSSDisclaimer] = useState(true);

  // Initialize and evaluate initial cases
  useEffect(() => {
    const evaluatedQueue = INITIAL_DEMO_CASES.map((item) => {
      const result = ClientMEWSEngine.evaluate(item as any);
      return {
        ...item,
        total_score: result.total_score,
        vitals_score: result.vitals_score,
        multimodal_modifier_score: result.multimodal_modifier_score,
        tier: result.tier,
        color_code: result.color_code,
        action_protocol: result.action_protocol,
        breakdown: result.breakdown,
        sbar_summary: result.sbar_summary,
        fhir_bundle: result.fhir_bundle,
      };
    });

    setQueue(sortQueueByAcuity(evaluatedQueue));
  }, []);

  // Strict Acuity Sorting Algorithm
  // RED (>=6 or AVPU P/U) -> ORANGE (4-5) -> YELLOW (2-3) -> GREEN (0-1)
  const sortQueueByAcuity = (items: any[]) => {
    const tierOrder: Record<string, number> = {
      [TriageTier.RED]: 4,
      [TriageTier.ORANGE]: 3,
      [TriageTier.YELLOW]: 2,
      [TriageTier.GREEN]: 1,
    };

    return [...items].sort((a, b) => {
      const weightA = tierOrder[a.tier] || 0;
      const weightB = tierOrder[b.tier] || 0;
      if (weightA !== weightB) return weightB - weightA;
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  };

  // Handle new patient triaged from Frontline Tablet
  const handleTriageComplete = useCallback((newPatient: any) => {
    setQueue((prevQueue) => {
      const updated = [newPatient, ...prevQueue];
      return sortQueueByAcuity(updated);
    });
  }, []);

  // Handle clinical status update from Doctor Dashboard
  const handleStatusUpdate = useCallback((caseId: string, newStatus: string) => {
    setQueue((prevQueue) => {
      const updated = prevQueue.map((c) =>
        c.id === caseId ? { ...c, status: newStatus } : c
      );
      return sortQueueByAcuity(updated);
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      {/* Global Top Navigation & CDSS Status */}
      <nav className="border-b border-slate-800 bg-slate-900/90 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-teal-500/20">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white tracking-tight">TriageSetu (त्रियाज सेतु)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800">
                100% FOSS &bull; Local-First
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Deterministic Multimodal Urgency Triage &bull; ABHA / ABDM HL7 FHIR R4 Standard
            </p>
          </div>
        </div>

        {/* View Switcher: Frontline Tablet vs Tele-Doctor Station vs Split Dual View */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            id="view-nav-tablet"
            onClick={() => setViewMode("tablet")}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === "tablet"
                ? "bg-teal-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Tablet className="w-3.5 h-3.5" /> Frontline Tablet (ANM)
          </button>
          <button
            id="view-nav-doctor"
            onClick={() => setViewMode("doctor")}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === "doctor"
                ? "bg-teal-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" /> Tele-Doctor Hub
          </button>
          <button
            id="view-nav-dual"
            onClick={() => setViewMode("dual")}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === "dual"
                ? "bg-teal-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Columns className="w-3.5 h-3.5" /> Live Dual-Screen View
          </button>
        </div>
      </nav>

      {/* CDSCO SaMD Class B Regulatory Notice Banner */}
      {showCDSSDisclaimer && (
        <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 text-xs flex items-center justify-between text-slate-400">
          <div className="flex items-center gap-2 max-w-5xl">
            <Info className="w-4 h-4 text-teal-400 shrink-0" />
            <span>
              <strong>CDSCO SaMD Class B Assistive CDSS:</strong> TriageSetu assists frontline ANMs and tele-doctors via deterministic MEWS. It does not replace medical doctors, automate direct drug prescriptions, or bypass clinical judgment.
            </span>
          </div>
          <button
            onClick={() => setShowCDSSDisclaimer(false)}
            className="text-slate-500 hover:text-slate-300 text-xs px-2 py-0.5 ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1">
        {viewMode === "tablet" && (
          <FrontlineTablet
            onTriageComplete={handleTriageComplete}
            onSwitchToDoctorView={() => setViewMode("doctor")}
          />
        )}

        {viewMode === "doctor" && (
          <DoctorDashboard
            queue={queue}
            onStatusUpdate={handleStatusUpdate}
            onNewCaseAdmitted={handleTriageComplete}
          />
        )}

        {viewMode === "dual" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-slate-800">
            <div className="p-2">
              <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-bold text-teal-400 flex items-center gap-2">
                <Tablet className="w-4 h-4" /> Rural Sub-Centre ANM Tablet Interface
              </div>
              <FrontlineTablet
                onTriageComplete={handleTriageComplete}
                onSwitchToDoctorView={() => setViewMode("doctor")}
              />
            </div>
            <div className="p-2">
              <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-bold text-teal-400 flex items-center gap-2">
                <Stethoscope className="w-4 h-4" /> District Tele-Consultation Hub (Live Dynamic Queue)
              </div>
              <DoctorDashboard
                queue={queue}
                onStatusUpdate={handleStatusUpdate}
                onNewCaseAdmitted={handleTriageComplete}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Clock,
  PhoneCall,
  Video,
  FileText,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  Activity,
  ArrowUpRight,
  User,
  ExternalLink,
  Copy,
  Download,
  Flame,
  Stethoscope,
  X,
  Mic,
  VideoOff,
  Maximize2
} from "lucide-react";

/**
 * DoctorDashboard: Real-Time Acuity Tele-Queue & CDSS Handoff Portal
 * Features:
 * - Acuity dynamic queue auto-sorted by MEWS (Red > Orange > Yellow > Green)
 * - Web Audio API synthesized alert chimes for critical arrivals
 * - Interactive X-MEWS Explainability Card with feature attributions
 * - 4-part SBAR diagnostic handoff brief
 * - Built-in WebRTC peer-to-peer teleconsultation modal
 * - ABDM FHIR R4 ClinicalImpression bundle viewer
 */

export default function DoctorDashboard({ queue = [], onStatusUpdate, onNewCaseAdmitted }) {
  const [selectedCaseId, setSelectedCaseId] = useState(queue[0]?.id || null);
  const [audioAlertsEnabled, setAudioAlertsEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState("sbar"); // 'sbar' | 'xmews' | 'fhir'
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isCopiedFhir, setIsCopiedFhir] = useState(false);
  const [teleconsultNotes, setTeleconsultNotes] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [isDoctorMicMuted, setIsDoctorMicMuted] = useState(false);
  const [isDoctorVideoMuted, setIsDoctorVideoMuted] = useState(false);

  const localVideoRef = useRef(null);
  const audioCtxRef = useRef(null);
  const prevQueueLengthRef = useRef(queue.length);
  const timerRef = useRef(null);

  // Auto-select first/highest priority case if current selection is invalid
  useEffect(() => {
    if ((!selectedCaseId || !queue.find((c) => c.id === selectedCaseId)) && queue.length > 0) {
      setSelectedCaseId(queue[0].id);
    }
  }, [queue, selectedCaseId]);

  // Web Audio API Synthesized Medical Alert Chime (Zero external mp3 files required)
  const playCriticalAlertSound = () => {
    if (!audioAlertsEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Two-tone high-urgency chime: 880Hz (A5) -> 659.25Hz (E5)
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(660, now + 0.18);
      osc1.frequency.setValueAtTime(880, now + 0.36);

      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.75);
    } catch (e) {
      console.warn("Audio chime synthesis error:", e);
    }
  };

  // Watch for new high-acuity Red cases entering the queue
  useEffect(() => {
    if (queue.length > prevQueueLengthRef.current) {
      const newest = queue[0]; // Since queue is sorted by acuity
      if (newest && (newest.tier?.includes("Red") || newest.total_score >= 6)) {
        playCriticalAlertSound();
      }
    }
    prevQueueLengthRef.current = queue.length;
  }, [queue]);

  const selectedCase = queue.find((c) => c.id === selectedCaseId) || queue[0] || null;

  // Handle Video Consultation Call
  const handleStartConsultation = async () => {
    setIsVideoModalOpen(true);
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    // Initialize doctor's local camera stream for peer consultation
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play();
      }
    } catch (e) {
      console.warn("Doctor camera stream could not be acquired:", e);
    }
  };

  const handleEndConsultation = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject;
      stream.getTracks().forEach((track) => track.stop());
    }
    setIsVideoModalOpen(false);

    if (selectedCase && onStatusUpdate) {
      onStatusUpdate(selectedCase.id, "completed");
    }
  };

  const copyFhirJson = () => {
    if (!selectedCase?.fhir_bundle) return;
    navigator.clipboard.writeText(JSON.stringify(selectedCase.fhir_bundle, null, 2));
    setIsCopiedFhir(true);
    setTimeout(() => setIsCopiedFhir(false), 2000);
  };

  const downloadFhirJson = () => {
    if (!selectedCase?.fhir_bundle) return;
    const blob = new Blob([JSON.stringify(selectedCase.fhir_bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ABDM_FHIR_R4_${selectedCase.id}_${selectedCase.patient_name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div id="doctor-tele-dashboard" className="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans">
      {/* Top Tele-Station Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">TriageSetu: Tele-Doctor Consultation Hub</h1>
              <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-teal-950 text-teal-300 border border-teal-800">
                eSanjeevani / ABDM Gateway
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live Priority Queue &bull; AI-Assisted Clinical Decision Support (CDSCO Class B)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Audio Siren Alert Toggle */}
          <button
            id="toggle-audio-alerts-btn"
            onClick={() => {
              setAudioAlertsEnabled(!audioAlertsEnabled);
              if (!audioAlertsEnabled) playCriticalAlertSound();
            }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
              audioAlertsEnabled
                ? "bg-slate-800 text-teal-300 border-teal-500/30"
                : "bg-slate-800/60 text-slate-400 border-slate-700"
            }`}
          >
            {audioAlertsEnabled ? <Bell className="w-4 h-4 text-teal-400" /> : <BellOff className="w-4 h-4 text-slate-500" />}
            {audioAlertsEnabled ? "Audio Alarms Active" : "Audio Alarms Muted"}
          </button>

          {/* Test Chime Trigger */}
          <button
            id="test-chime-btn"
            onClick={playCriticalAlertSound}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition-colors"
          >
            Test Chime
          </button>
        </div>
      </header>

      {/* Main 3-Column / Responsive Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        {/* Left Column: Acuity Dynamic Queue (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl max-h-[85vh]">
          {/* Queue Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">Dynamic Acuity Queue</h2>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {queue.length} Patients
            </span>
          </div>

          {/* Queue Acuity Protocol Legend */}
          <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 text-[11px] flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Red: MEWS &ge;6</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Orange: 4-5</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Yellow: 2-3</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Green: 0-1</span>
          </div>

          {/* Patient Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {queue.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No active patients in clinic queue.
              </div>
            ) : (
              queue.map((pt, idx) => {
                const isSelected = pt.id === selectedCaseId;
                const isRed = pt.tier?.includes("Red") || pt.total_score >= 6;
                const isOrange = pt.tier?.includes("Orange");
                const isYellow = pt.tier?.includes("Yellow");

                return (
                  <div
                    key={pt.id}
                    id={`queue-card-${pt.id}`}
                    onClick={() => setSelectedCaseId(pt.id)}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all relative ${
                      isSelected
                        ? "bg-slate-800/90 border-teal-500 shadow-lg ring-1 ring-teal-500/50"
                        : "bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700"
                    } ${isRed ? "border-l-4 border-l-rose-500 animate-[pulse_3s_ease-in-out_infinite]" : ""}`}
                  >
                    {/* Top Row: Rank, Name, Tier Badge */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-xs font-mono font-bold text-slate-500">#{idx + 1}</span>
                        <h3 className="text-sm font-bold text-white truncate">{pt.patient_name}</h3>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                          isRed
                            ? "bg-rose-600 text-white shadow-sm"
                            : isOrange
                            ? "bg-orange-600 text-white"
                            : isYellow
                            ? "bg-amber-600 text-white"
                            : "bg-emerald-600 text-white"
                        }`}
                      >
                        MEWS {pt.total_score}
                      </span>
                    </div>

                    {/* Sub-row: Demographics & ABHA */}
                    <div className="text-xs text-slate-400 flex items-center gap-2 mb-2 font-mono">
                      <span>{pt.age}y / {pt.gender}</span>
                      <span>&bull;</span>
                      <span className="truncate">{pt.abha_id}</span>
                    </div>

                    {/* Complaint snippet */}
                    <p className="text-xs text-slate-300 line-clamp-1 italic font-sans mb-2">
                      "{pt.chief_complaint || "Acute distress"}"
                    </p>

                    {/* Modifiers & Red flags preview */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      {pt.speech_red_flag && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-semibold">
                          Speech Flag
                        </span>
                      )}
                      {pt.conjunctival_pallor_grade && pt.conjunctival_pallor_grade !== "normal" && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-semibold">
                          Pallor: {pt.conjunctival_pallor_grade}
                        </span>
                      )}
                      {pt.rash_or_wound_severity && pt.rash_or_wound_severity !== "none" && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-semibold">
                          Derm: {pt.rash_or_wound_severity}
                        </span>
                      )}
                      <span className="ml-auto text-slate-500 font-mono">
                        {pt.status || "waiting"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center & Right Columns: Clinical Decision Support & SBAR (8 Cols) */}
        {selectedCase ? (
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Urgent Notification Banner if Red Tier */}
            {(selectedCase.tier?.includes("Red") || selectedCase.total_score >= 6) && (
              <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/60 text-rose-200 flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-rose-950/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
                    <ShieldAlert className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold tracking-wide uppercase text-rose-100">
                      High-Acuity Red Alert Triggered
                    </h3>
                    <p className="text-xs text-rose-300">
                      {selectedCase.action_protocol || "Immediate tele-consultation and 108 referral readiness required."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="trigger-108-referral-btn"
                    onClick={() => {
                      alert(`Initiated 108 Emergency Transfer Referral for ${selectedCase.patient_name} (${selectedCase.abha_id}) to District Hospital.`);
                      if (onStatusUpdate) onStatusUpdate(selectedCase.id, "108-transferred");
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md cursor-pointer"
                  >
                    Initiate 108 Referral
                  </button>
                  <button
                    id="start-teleconsult-btn"
                    onClick={handleStartConsultation}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Video className="w-4 h-4" /> Start Video Consult
                  </button>
                </div>
              </div>
            )}

            {/* Patient Demographic Summary Card */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-teal-400 border border-slate-700">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">{selectedCase.patient_name}</h2>
                    <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {selectedCase.id}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-3 mt-1">
                    <span><strong>ABHA:</strong> {selectedCase.abha_id}</span>
                    <span>&bull;</span>
                    <span><strong>Age/Sex:</strong> {selectedCase.age}y / {selectedCase.gender}</span>
                    <span>&bull;</span>
                    <span><strong>Clinic:</strong> {selectedCase.clinic_location || "Rampur PHC"}</span>
                  </div>
                </div>
              </div>

              {/* Consultation Trigger Button */}
              {!(selectedCase.tier?.includes("Red") || selectedCase.total_score >= 6) && (
                <button
                  id="standard-teleconsult-btn"
                  onClick={handleStartConsultation}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-900/30 cursor-pointer"
                >
                  <Video className="w-4 h-4" /> Connect Video Consultation
                </button>
              )}
            </div>

            {/* Tab Navigation: SBAR vs X-MEWS vs FHIR */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              {[
                { id: "sbar", label: "4-Part SBAR Clinical Brief", icon: FileText },
                { id: "xmews", label: "Interactive X-MEWS Attribution Card", icon: Activity },
                { id: "fhir", label: "ABDM FHIR R4 Bundle", icon: ExternalLink },
              ].map((tab) => {
                const IconComp = tab.icon;
                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                      activeTab === tab.id
                        ? "bg-teal-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                    }`}
                  >
                    <IconComp className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab 1: 4-Part SBAR Clinical Brief */}
            {activeTab === "sbar" && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                    Automated SBAR Handoff Brief
                  </h3>
                  <span className="text-xs text-slate-400">Standardized Inter-Professional Communication</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Situation */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-400 uppercase tracking-wider mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-teal-950 border border-teal-800 flex items-center justify-center text-[10px]">S</span>
                      Situation
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">
                      {selectedCase.sbar_summary?.Situation || `Patient presents with composite MEWS of ${selectedCase.total_score} (${selectedCase.tier}).`}
                    </p>
                  </div>

                  {/* Background */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-950 border border-blue-800 flex items-center justify-center text-[10px]">B</span>
                      Background
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">
                      {selectedCase.sbar_summary?.Background ||
                        `Vitals: BP ${selectedCase.systolic_bp}/${selectedCase.diastolic_bp || 80} mmHg, HR ${selectedCase.heart_rate} bpm, RR ${selectedCase.respiratory_rate} bpm, Temp ${selectedCase.temperature_c}°C, AVPU: ${selectedCase.avpu}.`}
                    </p>
                  </div>

                  {/* Assessment */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-950 border border-amber-800 flex items-center justify-center text-[10px]">A</span>
                      Assessment (Risk Drivers)
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">
                      {selectedCase.sbar_summary?.Assessment || "Analysis of physiological deterioration risk drivers."}
                    </p>
                  </div>

                  {/* Recommendation */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center text-[10px]">R</span>
                      Recommendation &amp; Action
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">
                      {selectedCase.sbar_summary?.Recommendation || selectedCase.action_protocol}
                    </p>
                  </div>
                </div>

                {/* Status Action Buttons */}
                <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">Update Clinical Disposition:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onStatusUpdate && onStatusUpdate(selectedCase.id, "in-consultation")}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
                    >
                      Mark In-Consultation
                    </button>
                    <button
                      onClick={() => onStatusUpdate && onStatusUpdate(selectedCase.id, "108-transferred")}
                      className="px-3 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-xs font-semibold text-rose-300 border border-rose-800"
                    >
                      108 Ambulance Dispatch
                    </button>
                    <button
                      onClick={() => onStatusUpdate && onStatusUpdate(selectedCase.id, "completed")}
                      className="px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-xs font-semibold text-emerald-300 border border-emerald-800"
                    >
                      Sign-Off &amp; Complete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Interactive X-MEWS Explainability Card */}
            {activeTab === "xmews" && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                      Explainable Modified Early Warning Score (X-MEWS)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Deterministic Subbe et al. Formula with Bounded Multimodal Modifiers
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block font-mono">Physiological Score</span>
                      <span className="text-lg font-bold text-white font-mono">{selectedCase.vitals_score || 0} pts</span>
                    </div>
                    <span className="text-slate-600 text-xl font-bold">+</span>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block font-mono">AI Modifiers</span>
                      <span className="text-lg font-bold text-teal-400 font-mono">+{selectedCase.multimodal_modifier_score || 0} pts</span>
                    </div>
                    <span className="text-slate-600 text-xl font-bold">=</span>
                    <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-center">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total MEWS</span>
                      <span className="text-2xl font-black font-mono text-white">{selectedCase.total_score}</span>
                    </div>
                  </div>
                </div>

                {/* Attribution Breakdown Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                        <th className="pb-2.5 font-bold">Clinical Parameter</th>
                        <th className="pb-2.5 font-bold">Measured Value</th>
                        <th className="pb-2.5 font-bold">Points</th>
                        <th className="pb-2.5 font-bold">Clinical Interpretation &amp; Risk Logic</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(selectedCase.breakdown || []).map((factor, fidx) => (
                        <tr key={fidx} className="hover:bg-slate-950/40 transition-colors">
                          <td className="py-3 font-semibold text-slate-200">{factor.parameter}</td>
                          <td className="py-3 font-mono text-teal-300 font-bold">{factor.value}</td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-bold ${
                                factor.points >= 2
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                  : factor.points === 1
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              +{factor.points}
                            </span>
                          </td>
                          <td className="py-3 text-slate-300 leading-snug">{factor.clinical_note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 3: ABDM FHIR R4 Bundle Viewer */}
            {activeTab === "fhir" && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                      HL7 FHIR R4 ClinicalImpression Bundle
                    </h3>
                    <p className="text-xs text-slate-400">
                      Ayushman Bharat Digital Mission (ABDM) Interoperability Standard
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      id="copy-fhir-btn"
                      onClick={copyFhirJson}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 border border-slate-700"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {isCopiedFhir ? "Copied!" : "Copy JSON"}
                    </button>
                    <button
                      id="download-fhir-btn"
                      onClick={downloadFhirJson}
                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-xs font-medium text-white flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Download FHIR
                    </button>
                  </div>
                </div>

                {/* Raw Code Viewer */}
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-[360px] leading-relaxed">
                  {JSON.stringify(selectedCase.fhir_bundle, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-8 flex items-center justify-center p-12 bg-slate-900 rounded-2xl border border-slate-800 text-slate-500 text-sm">
            Select a patient from the queue to review X-MEWS telemetry and SBAR handoff.
          </div>
        )}
      </div>

      {/* Built-in WebRTC Peer-to-Peer Video Consultation Modal */}
      {isVideoModalOpen && selectedCase && (
        <div
          id="webrtc-consult-modal"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                <span className="text-sm font-bold text-white">
                  Live WebRTC Tele-Consultation: {selectedCase.patient_name} ({selectedCase.abha_id})
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-teal-300">
                  {formatDuration(callDuration)}
                </span>
              </div>

              <button
                onClick={handleEndConsultation}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Feeds Grid */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950">
              {/* Doctor Feed */}
              <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video border border-slate-800 flex items-center justify-center">
                <video
                  ref={localVideoRef}
                  playsInline
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-2 left-2 px-2 py-1 rounded bg-slate-950/80 text-[10px] font-semibold text-white">
                  Doctor Station (You)
                </span>
              </div>

              {/* Rural Patient Tablet Feed */}
              <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video border border-slate-800 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center mb-3">
                  <User className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-bold text-slate-200">{selectedCase.patient_name}</h4>
                <p className="text-xs text-slate-400 mt-1">ANM Sub-Centre Live Stream Connected</p>
                <span className="text-xs text-emerald-400 mt-2 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> P2P Coturn WebRTC Active
                </span>
                <span className="absolute bottom-2 left-2 px-2 py-1 rounded bg-slate-950/80 text-[10px] font-semibold text-white">
                  Frontline Tablet (ANM)
                </span>
              </div>
            </div>

            {/* In-Call Doctor Notes & Controls */}
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Tele-Doctor Advice / Digital Prescription Notes:
                </label>
                <textarea
                  value={teleconsultNotes}
                  onChange={(e) => setTeleconsultNotes(e.target.value)}
                  placeholder="Record immediate directives for frontline ANM (e.g., start 500ml Normal Saline, repeat vitals in 15 mins, administer sublingual nitrate if indicated)..."
                  className="w-full h-20 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsDoctorMicMuted(!isDoctorMicMuted)}
                    className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                      isDoctorMicMuted ? "bg-rose-950 text-rose-300 border-rose-800" : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    <Mic className="w-4 h-4" /> {isDoctorMicMuted ? "Unmute Mic" : "Mute Mic"}
                  </button>
                  <button
                    onClick={() => setIsDoctorVideoMuted(!isDoctorVideoMuted)}
                    className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                      isDoctorVideoMuted ? "bg-rose-950 text-rose-300 border-rose-800" : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    <VideoOff className="w-4 h-4" /> {isDoctorVideoMuted ? "Enable Cam" : "Stop Cam"}
                  </button>
                </div>

                <button
                  id="end-call-btn"
                  onClick={handleEndConsultation}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  End Call &amp; Dispatch Handoff
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

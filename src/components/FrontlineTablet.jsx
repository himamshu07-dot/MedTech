import React, { useState } from "react";
import {
  Heart,
  Activity,
  Thermometer,
  Wind,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Send,
  User,
  MapPin,
  Calendar,
  Sparkles,
  ClipboardList,
  RefreshCw,
  Eye,
  Camera
} from "lucide-react";
import SetuAgent from "./SetuAgent.jsx";
import CameraReticle from "./CameraReticle.jsx";
import { ClientMEWSEngine } from "../services/mewsEngine.ts";

/**
 * FrontlineTablet: 3-Step ANM / CHO Clinical Intake Wizard
 * Tailored for rural Android tablets:
 * - Minimum 48px touch targets
 * - High-contrast layout
 * - Step 1: SetuAgent Vernacular Voice Intake
 * - Step 2: Edge Camera Biomarker Reticle (Conjunctival Pallor & Dermatology)
 * - Step 3: Physical Vitals Telemetry & Human-in-the-Loop Validation
 */

export default function FrontlineTablet({ onTriageComplete, onSwitchToDoctorView }) {
  const [currentStep, setCurrentStep] = useState(1);

  // Patient Demographic Information
  const [patientData, setPatientData] = useState({
    patient_name: "Sunita Devi",
    abha_id: "ABHA-91-8273-1029-44",
    age: 42,
    gender: "Female",
    clinic_location: "Ayushman Arogya Mandir - Rampur PHC",
    chief_complaint: "",
    extracted_symptoms: [],
    red_flags: [],
  });

  // Physical Vitals Telemetry (Step 3)
  const [vitals, setVitals] = useState({
    systolic_bp: 110,
    diastolic_bp: 75,
    heart_rate: 82,
    respiratory_rate: 16,
    temperature_c: 37.0,
    spo2: 98,
    avpu: "A",
    conjunctival_pallor_grade: "normal",
    rash_or_wound_severity: "none",
    speech_red_flag: false,
    erythema_index: null,
    estimated_hb: null,
  });

  const [triageFeedback, setTriageFeedback] = useState(null);

  // Handle Voice Intake (Step 1 -> Step 2)
  const handleProceedFromVoice = (voiceDraft) => {
    setPatientData((prev) => ({
      ...prev,
      chief_complaint: voiceDraft.chief_complaint || prev.chief_complaint,
      extracted_symptoms: voiceDraft.extracted_symptoms || [],
      red_flags: voiceDraft.red_flags || [],
    }));

    setVitals((prev) => ({
      ...prev,
      speech_red_flag: !!voiceDraft.speech_red_flag,
      systolic_bp: voiceDraft.systolic_bp ?? prev.systolic_bp,
      diastolic_bp: voiceDraft.diastolic_bp ?? prev.diastolic_bp,
      heart_rate: voiceDraft.heart_rate ?? prev.heart_rate,
      respiratory_rate: voiceDraft.respiratory_rate ?? prev.respiratory_rate,
      temperature_c: voiceDraft.temperature_c ?? prev.temperature_c,
      spo2: voiceDraft.spo2 ?? prev.spo2,
      avpu: voiceDraft.avpu ?? prev.avpu,
      conjunctival_pallor_grade: voiceDraft.conjunctival_pallor_grade ?? prev.conjunctival_pallor_grade,
      rash_or_wound_severity: voiceDraft.rash_or_wound_severity ?? prev.rash_or_wound_severity,
    }));

    setCurrentStep(2);
  };

  // Handle Camera Biomarkers (Step 2 -> Step 3)
  const handleProceedFromCamera = (biomarkers) => {
    setVitals((prev) => ({
      ...prev,
      conjunctival_pallor_grade: biomarkers.conjunctival_pallor_grade || prev.conjunctival_pallor_grade,
      rash_or_wound_severity: biomarkers.rash_or_wound_severity || prev.rash_or_wound_severity,
      erythema_index: biomarkers.erythema_index,
      estimated_hb: biomarkers.estimated_hb,
    }));
    setCurrentStep(3);
  };

  // Quick Vitals Assessment Colors (Abnormal = Amber/Crimson)
  const getSbpStatus = () => {
    if (vitals.systolic_bp <= 70) return { color: "text-rose-400 bg-rose-950/40 border-rose-600", tag: "Severe Shock (+3)" };
    if (vitals.systolic_bp <= 80) return { color: "text-rose-400 bg-rose-950/40 border-rose-600", tag: "Hypotension (+2)" };
    if (vitals.systolic_bp <= 100) return { color: "text-amber-400 bg-amber-950/40 border-amber-600", tag: "Borderline (+1)" };
    if (vitals.systolic_bp >= 200) return { color: "text-rose-400 bg-rose-950/40 border-rose-600", tag: "Crisis (+2)" };
    return { color: "text-slate-200 bg-slate-900 border-slate-700", tag: "Normal (0)" };
  };

  const getHrStatus = () => {
    if (vitals.heart_rate >= 130) return { color: "text-rose-400 bg-rose-950/40 border-rose-600", tag: "Severe Tachy (+3)" };
    if (vitals.heart_rate >= 111) return { color: "text-rose-400 bg-rose-950/40 border-rose-600", tag: "Tachycardia (+2)" };
    if (vitals.heart_rate >= 101) return { color: "text-amber-400 bg-amber-950/40 border-amber-600", tag: "Mild Tachy (+1)" };
    if (vitals.heart_rate <= 40) return { color: "text-rose-400 bg-rose-950/40 border-rose-600", tag: "Severe Brady (+2)" };
    if (vitals.heart_rate <= 50) return { color: "text-amber-400 bg-amber-950/40 border-amber-600", tag: "Bradycardia (+1)" };
    return { color: "text-slate-200 bg-slate-900 border-slate-700", tag: "Normal (0)" };
  };

  const getRrStatus = () => {
    if (vitals.respiratory_rate >= 30) return { color: "text-rose-400 bg-rose-950/40 border-rose-600", tag: "Severe Distress (+3)" };
    if (vitals.respiratory_rate >= 21) return { color: "text-rose-400 bg-rose-950/40 border-rose-600", tag: "Tachypnea (+2)" };
    if (vitals.respiratory_rate >= 15) return { color: "text-amber-400 bg-amber-950/40 border-amber-600", tag: "Mild Tachypnea (+1)" };
    if (vitals.respiratory_rate <= 8) return { color: "text-rose-400 bg-rose-950/40 border-rose-600", tag: "Bradypnea (+2)" };
    return { color: "text-slate-200 bg-slate-900 border-slate-700", tag: "Normal (0)" };
  };

  const getTempStatus = () => {
    if (vitals.temperature_c >= 38.5) return { color: "text-rose-400 bg-rose-950/40 border-rose-600", tag: "High Pyrexia (+2)" };
    if (vitals.temperature_c >= 37.5) return { color: "text-amber-400 bg-amber-950/40 border-amber-600", tag: "Low Pyrexia (+1)" };
    if (vitals.temperature_c <= 35.0) return { color: "text-rose-400 bg-rose-950/40 border-rose-600", tag: "Hypothermia (+2)" };
    return { color: "text-slate-200 bg-slate-900 border-slate-700", tag: "Normal (0)" };
  };

  // Submit & Triage (Human-in-the-loop ANM Validation)
  const handleSubmitTriage = () => {
    const fullPatientRecord = {
      ...patientData,
      ...vitals,
      timestamp: new Date().toISOString(),
      id: `CASE-${Math.floor(100 + Math.random() * 900)}`,
      status: "waiting",
    };

    const evaluation = ClientMEWSEngine.evaluate(fullPatientRecord);

    const finalizedCase = {
      ...fullPatientRecord,
      total_score: evaluation.total_score,
      vitals_score: evaluation.vitals_score,
      multimodal_modifier_score: evaluation.multimodal_modifier_score,
      tier: evaluation.tier,
      color_code: evaluation.color_code,
      action_protocol: evaluation.action_protocol,
      breakdown: evaluation.breakdown,
      sbar_summary: evaluation.sbar_summary,
      fhir_bundle: evaluation.fhir_bundle,
    };

    setTriageFeedback(finalizedCase);

    if (onTriageComplete) {
      onTriageComplete(finalizedCase);
    }
  };

  const handleResetForNextPatient = () => {
    setTriageFeedback(null);
    setCurrentStep(1);
    const names = ["Ram Lal", "Munni Devi", "Guddu Singh", "Sharda Bai", "Anil Sharma"];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomAbha = `ABHA-91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`;
    setPatientData({
      patient_name: randomName,
      abha_id: randomAbha,
      age: Math.floor(20 + Math.random() * 55),
      gender: Math.random() > 0.5 ? "Female" : "Male",
      clinic_location: "Ayushman Arogya Mandir - Rampur PHC",
      chief_complaint: "",
      extracted_symptoms: [],
      red_flags: [],
    });
    setVitals({
      systolic_bp: 115,
      diastolic_bp: 75,
      heart_rate: 78,
      respiratory_rate: 16,
      temperature_c: 37.0,
      spo2: 98,
      avpu: "A",
      conjunctival_pallor_grade: "normal",
      rash_or_wound_severity: "none",
      speech_red_flag: false,
      erythema_index: null,
      estimated_hb: null,
    });
  };

  return (
    <div id="frontline-tablet-wizard" className="bg-slate-950 text-slate-100 min-h-screen p-4 sm:p-6 font-sans">
      {/* Top Banner: Clinic Info & Step Progress */}
      <div className="max-w-6xl mx-auto mb-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">TriageSetu Frontline Tablet</h1>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                  Offline-First Mode
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-teal-400" />
                <span>{patientData.clinic_location}</span>
                <span>&bull;</span>
                <span>ANM: Sunita Sharma (Reg. #ANM-2024-88)</span>
              </p>
            </div>
          </div>

          {/* Quick Doctor View Switcher */}
          <button
            id="switch-to-doctor-btn"
            onClick={onSwitchToDoctorView}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            Switch to Tele-Doctor Station <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step Indicator Wizard (>= 48px height) */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { step: 1, label: "1. SetuAgent Voice", desc: "Vernacular Complaint" },
            { step: 2, label: "2. Camera Reticle", desc: "Mucosal & Derm Scan" },
            { step: 3, label: "3. Physical Vitals", desc: "Human-in-the-Loop" },
          ].map((s) => (
            <button
              key={s.step}
              onClick={() => setCurrentStep(s.step)}
              className={`min-h-[54px] p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                currentStep === s.step
                  ? "bg-teal-950/60 border-teal-500 ring-1 ring-teal-400/40 shadow-md"
                  : currentStep > s.step
                  ? "bg-slate-800/80 border-slate-700 text-slate-300"
                  : "bg-slate-900/40 border-slate-800 text-slate-500"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{s.label}</span>
                {currentStep > s.step && <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />}
              </div>
              <span className="text-[11px] text-slate-400 block">{s.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto">
        {/* Triage Completion Feedback Banner */}
        {triageFeedback && (
          <div
            className={`p-6 rounded-2xl mb-6 border shadow-2xl transition-all ${
              triageFeedback.tier?.includes("Red") || triageFeedback.total_score >= 6
                ? "bg-rose-950/70 border-rose-500 shadow-rose-950/50"
                : triageFeedback.tier?.includes("Orange")
                ? "bg-orange-950/70 border-orange-500 shadow-orange-950/50"
                : triageFeedback.tier?.includes("Yellow")
                ? "bg-amber-950/70 border-amber-500 shadow-amber-950/50"
                : "bg-emerald-950/70 border-emerald-500 shadow-emerald-950/50"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-lg"
                  style={{ backgroundColor: triageFeedback.color_code }}
                >
                  {triageFeedback.total_score}
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Triage Evaluated &amp; Dispatched to Tele-Queue
                  </span>
                  <h2 className="text-xl font-black text-white">{triageFeedback.tier}</h2>
                  <p className="text-xs text-slate-200 mt-0.5">{triageFeedback.action_protocol}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  id="view-in-doctor-queue-btn"
                  onClick={onSwitchToDoctorView}
                  className="px-5 py-2.5 rounded-xl bg-white text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  View Dynamic Queue Position <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  id="admit-next-patient-btn"
                  onClick={handleResetForNextPatient}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center gap-2 border border-slate-700 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" /> Admit Next Patient
                </button>
              </div>
            </div>

            {/* SBAR Quick View */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                <span className="font-bold text-teal-400 block mb-1">Situation</span>
                <p className="text-slate-300 line-clamp-2">{triageFeedback.sbar_summary?.Situation}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                <span className="font-bold text-blue-400 block mb-1">Background</span>
                <p className="text-slate-300 line-clamp-2">{triageFeedback.sbar_summary?.Background}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                <span className="font-bold text-amber-400 block mb-1">Assessment</span>
                <p className="text-slate-300 line-clamp-2">{triageFeedback.sbar_summary?.Assessment}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                <span className="font-bold text-emerald-400 block mb-1">Recommendation</span>
                <p className="text-slate-300 line-clamp-2">{triageFeedback.sbar_summary?.Recommendation}</p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: SetuAgent Vernacular Voice Intake */}
        {currentStep === 1 && (
          <SetuAgent
            onProceedToVision={handleProceedFromVoice}
            initialPatient={patientData}
          />
        )}

        {/* STEP 2: Edge Camera Biomarker Reticle */}
        {currentStep === 2 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-700"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Voice Intake
              </button>
              <span className="text-xs text-slate-400">Step 2: Palpebral Conjunctiva / Derm Scan</span>
            </div>

            <CameraReticle
              onCaptureComplete={handleProceedFromCamera}
              onSkip={() => setCurrentStep(3)}
              currentBiomarkers={vitals}
            />
          </div>
        )}

        {/* STEP 3: Physical Vitals Telemetry & Human-in-the-Loop Review */}
        {currentStep === 3 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Step 3: Physical Vitals &amp; Human-in-the-Loop Review
                  </h2>
                  <p className="text-xs text-slate-400">
                    Frontline ANM verifies vitals before deterministic MEWS calculation
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-700"
                >
                  <ArrowLeft className="w-4 h-4" /> Edit Biomarkers
                </button>
              </div>
            </div>

            {/* Patient Registration Details Form */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Patient Full Name:</label>
                <input
                  type="text"
                  value={patientData.patient_name}
                  onChange={(e) => setPatientData({ ...patientData, patient_name: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">14-Digit ABHA ID:</label>
                <input
                  type="text"
                  value={patientData.abha_id}
                  onChange={(e) => setPatientData({ ...patientData, abha_id: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-teal-300 font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Age (Years):</label>
                <input
                  type="number"
                  value={patientData.age}
                  onChange={(e) => setPatientData({ ...patientData, age: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Gender:</label>
                <select
                  value={patientData.gender}
                  onChange={(e) => setPatientData({ ...patientData, gender: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold focus:outline-none focus:border-teal-500"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Physiological Vitals Numeric Cards (Touch targets >= 48px) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Systolic BP */}
              <div className={`p-4 rounded-xl border transition-all ${getSbpStatus().color}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-4 h-4" /> Systolic BP
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/40">
                    {getSbpStatus().tag}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    value={vitals.systolic_bp}
                    onChange={(e) => setVitals({ ...vitals, systolic_bp: Number(e.target.value) })}
                    className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-2xl font-black font-mono text-white text-center focus:outline-none focus:border-teal-500 min-h-[48px]"
                  />
                  <span className="text-xs text-slate-400 font-mono">mmHg</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1.5 text-center">
                  Subbe rule: &le;70 (+3), 71-80 (+2), &ge;200 (+2)
                </span>
              </div>

              {/* Heart Rate */}
              <div className={`p-4 rounded-xl border transition-all ${getHrStatus().color}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Heart className="w-4 h-4" /> Heart Rate
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/40">
                    {getHrStatus().tag}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    value={vitals.heart_rate}
                    onChange={(e) => setVitals({ ...vitals, heart_rate: Number(e.target.value) })}
                    className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-2xl font-black font-mono text-white text-center focus:outline-none focus:border-teal-500 min-h-[48px]"
                  />
                  <span className="text-xs text-slate-400 font-mono">BPM</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1.5 text-center">
                  Subbe rule: &le;40 (+2), 111-129 (+2), &ge;130 (+3)
                </span>
              </div>

              {/* Respiratory Rate */}
              <div className={`p-4 rounded-xl border transition-all ${getRrStatus().color}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Wind className="w-4 h-4" /> Resp. Rate
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/40">
                    {getRrStatus().tag}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    value={vitals.respiratory_rate}
                    onChange={(e) => setVitals({ ...vitals, respiratory_rate: Number(e.target.value) })}
                    className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-2xl font-black font-mono text-white text-center focus:outline-none focus:border-teal-500 min-h-[48px]"
                  />
                  <span className="text-xs text-slate-400 font-mono">BPM</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1.5 text-center">
                  Subbe rule: &le;8 (+2), 21-29 (+2), &ge;30 (+3)
                </span>
              </div>

              {/* Temperature */}
              <div className={`p-4 rounded-xl border transition-all ${getTempStatus().color}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4" /> Core Temp
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/40">
                    {getTempStatus().tag}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    step="0.1"
                    value={vitals.temperature_c}
                    onChange={(e) => setVitals({ ...vitals, temperature_c: Number(e.target.value) })}
                    className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-2xl font-black font-mono text-white text-center focus:outline-none focus:border-teal-500 min-h-[48px]"
                  />
                  <span className="text-xs text-slate-400 font-mono">&deg;C</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1.5 text-center">
                  Subbe rule: &le;35.0 (+2), &ge;38.5 (+2)
                </span>
              </div>
            </div>

            {/* AVPU Neurological Status Radio Toggles (>= 48px touch targets) */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2">
                Neurological Consciousness Level (AVPU):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { key: "A", title: "Alert (0 pts)", sub: "Fully alert & oriented" },
                  { key: "V", title: "Voice (+1 pt)", sub: "Responds only to voice" },
                  { key: "P", title: "Pain (+2 pts)", sub: "Responds only to pain (Stupor)" },
                  { key: "U", title: "Unresponsive (+3 pts)", sub: "Comatose / Severe shock" },
                ].map((av) => (
                  <button
                    key={av.key}
                    type="button"
                    onClick={() => setVitals({ ...vitals, avpu: av.key })}
                    className={`min-h-[58px] p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      vitals.avpu === av.key
                        ? av.key === "P" || av.key === "U"
                          ? "bg-rose-950/80 border-rose-500 ring-2 ring-rose-500/40 text-rose-200"
                          : "bg-teal-950/80 border-teal-500 ring-2 ring-teal-500/40 text-teal-200"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{av.title}</span>
                      {vitals.avpu === av.key && <CheckCircle2 className="w-4 h-4 text-teal-400" />}
                    </div>
                    <span className="text-[10px] opacity-80 block mt-0.5">{av.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Multimodal AI Biomarkers Review */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2">
                Multimodal AI Modifiers (Captured from Camera &amp; Voice):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* Ocular Pallor */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Conjunctival Pallor:</span>
                  <select
                    value={vitals.conjunctival_pallor_grade || "normal"}
                    onChange={(e) => setVitals({ ...vitals, conjunctival_pallor_grade: e.target.value })}
                    className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold focus:outline-none focus:border-teal-500"
                  >
                    <option value="normal">Normal (+0 MEWS)</option>
                    <option value="mild">Mild Pallor (+1 MEWS)</option>
                    <option value="moderate">Moderate Pallor (+2 MEWS)</option>
                    <option value="severe">Severe Pallor (+3 MEWS)</option>
                  </select>
                </div>

                {/* Dermatology */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block mb-1">Skin / Wound Severity:</span>
                  <select
                    value={vitals.rash_or_wound_severity || "none"}
                    onChange={(e) => setVitals({ ...vitals, rash_or_wound_severity: e.target.value })}
                    className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold focus:outline-none focus:border-teal-500"
                  >
                    <option value="none">Intact / None (+0 MEWS)</option>
                    <option value="superficial">Superficial Abrasion (+0 MEWS)</option>
                    <option value="spreading_erythema">Spreading Erythema (+2 MEWS)</option>
                    <option value="deep_wound">Deep / Necrotic Tissue (+3 MEWS)</option>
                  </select>
                </div>

                {/* Speech Red-Flag */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block font-semibold">Speech Red Flag:</span>
                    <span className="text-[11px] text-slate-500">Syncope / Chest pain (+1)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={vitals.speech_red_flag}
                    onChange={(e) => setVitals({ ...vitals, speech_red_flag: e.target.checked })}
                    className="w-6 h-6 rounded text-teal-600 focus:ring-teal-500 border-slate-700 bg-slate-950 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Human-in-the-Loop Final Submit Button (>= 48px touch target) */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Class B CDSS &bull; Frontline ANM Validates Clinical Findings
              </span>

              <button
                id="submit-and-triage-btn"
                onClick={handleSubmitTriage}
                className="min-h-[50px] px-8 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-sm flex items-center gap-2.5 shadow-xl shadow-teal-950/60 active:scale-95 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" /> Submit &amp; Triage Patient
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * TriageSetu Client-side Deterministic MEWS Engine
 * 100% Deterministic Clinical Decision Support System (CDSS Class B)
 * Implements Subbe et al. MEWS with Bounded Multimodal Modifiers
 */

export enum AVPU {
  ALERT = "A",
  VOICE = "V",
  PAIN = "P",
  UNRESPONSIVE = "U",
}

export enum TriageTier {
  GREEN = "Green (Routine)",
  YELLOW = "Yellow (Moderate / Semi-Urgent)",
  ORANGE = "Orange (Urgent Priority)",
  RED = "Red (Critical / Emergency)",
}

export interface PatientVitalsData {
  patient_name: string;
  abha_id: string;
  age: number;
  gender: string;
  clinic_location?: string;
  systolic_bp: number;
  diastolic_bp?: number;
  heart_rate: number;
  respiratory_rate: number;
  temperature_c: number;
  spo2?: number;
  avpu: AVPU | string;
  conjunctival_pallor_grade?: "normal" | "mild" | "moderate" | "severe" | string;
  rash_or_wound_severity?: "none" | "superficial" | "spreading_erythema" | "deep_wound" | string;
  speech_red_flag: boolean;
  chief_complaint?: string;
  erythema_index?: number | null;
  estimated_hb?: number | null;
}

export interface ScoreFactor {
  parameter: string;
  value: string;
  points: number;
  clinical_note: string;
}

export interface SBARSummary {
  Situation: string;
  Background: string;
  Assessment: string;
  Recommendation: string;
}

export interface TriageResult {
  total_score: number;
  vitals_score: number;
  multimodal_modifier_score: number;
  tier: TriageTier;
  color_code: string;
  action_protocol: string;
  breakdown: ScoreFactor[];
  sbar_summary: SBARSummary;
  fhir_bundle: any;
}

export class ClientMEWSEngine {
  static scoreSbp(sbp: number): ScoreFactor {
    if (sbp <= 70) {
      return { parameter: "Systolic BP", value: `${sbp} mmHg`, points: 3, clinical_note: "Severe hypotension (shock risk)" };
    } else if (sbp <= 80) {
      return { parameter: "Systolic BP", value: `${sbp} mmHg`, points: 2, clinical_note: "Moderate hypotension" };
    } else if (sbp <= 100) {
      return { parameter: "Systolic BP", value: `${sbp} mmHg`, points: 1, clinical_note: "Mild borderline hypotension" };
    } else if (sbp <= 199) {
      return { parameter: "Systolic BP", value: `${sbp} mmHg`, points: 0, clinical_note: "Normal hemodynamic range" };
    } else {
      return { parameter: "Systolic BP", value: `${sbp} mmHg`, points: 2, clinical_note: "Severe hypertensive crisis" };
    }
  }

  static scoreHr(hr: number): ScoreFactor {
    if (hr <= 40) {
      return { parameter: "Heart Rate", value: `${hr} bpm`, points: 2, clinical_note: "Severe bradycardia" };
    } else if (hr <= 50) {
      return { parameter: "Heart Rate", value: `${hr} bpm`, points: 1, clinical_note: "Moderate bradycardia" };
    } else if (hr <= 100) {
      return { parameter: "Heart Rate", value: `${hr} bpm`, points: 0, clinical_note: "Normal rate" };
    } else if (hr <= 110) {
      return { parameter: "Heart Rate", value: `${hr} bpm`, points: 1, clinical_note: "Mild tachycardia" };
    } else if (hr <= 129) {
      return { parameter: "Heart Rate", value: `${hr} bpm`, points: 2, clinical_note: "Moderate tachycardia" };
    } else {
      return { parameter: "Heart Rate", value: `${hr} bpm`, points: 3, clinical_note: "Severe tachycardia (pre-decompensation)" };
    }
  }

  static scoreRr(rr: number): ScoreFactor {
    if (rr <= 8) {
      return { parameter: "Respiratory Rate", value: `${rr} bpm`, points: 2, clinical_note: "Severe bradypnea (hypoventilation)" };
    } else if (rr <= 14) {
      return { parameter: "Respiratory Rate", value: `${rr} bpm`, points: 0, clinical_note: "Normal respiratory pattern" };
    } else if (rr <= 20) {
      return { parameter: "Respiratory Rate", value: `${rr} bpm`, points: 1, clinical_note: "Mild tachypnea" };
    } else if (rr <= 29) {
      return { parameter: "Respiratory Rate", value: `${rr} bpm`, points: 2, clinical_note: "Moderate tachypnea" };
    } else {
      return { parameter: "Respiratory Rate", value: `${rr} bpm`, points: 3, clinical_note: "Severe respiratory distress" };
    }
  }

  static scoreTemp(temp: number): ScoreFactor {
    if (temp <= 35.0) {
      return { parameter: "Temperature", value: `${temp.toFixed(1)} °C`, points: 2, clinical_note: "Hypothermia" };
    } else if (temp <= 37.4) {
      return { parameter: "Temperature", value: `${temp.toFixed(1)} °C`, points: 0, clinical_note: "Normothermia" };
    } else if (temp <= 38.4) {
      return { parameter: "Temperature", value: `${temp.toFixed(1)} °C`, points: 1, clinical_note: "Low-grade pyrexia" };
    } else {
      return { parameter: "Temperature", value: `${temp.toFixed(1)} °C`, points: 2, clinical_note: "High pyrexia (sepsis/infection indicator)" };
    }
  }

  static scoreAvpu(avpu: string): ScoreFactor {
    const norm = avpu.toUpperCase();
    if (norm === "U" || norm === "UNRESPONSIVE") {
      return { parameter: "Neurological (AVPU)", value: "U", points: 3, clinical_note: "Unresponsive (coma/acute cerebral hypoperfusion)" };
    } else if (norm === "P" || norm === "PAIN") {
      return { parameter: "Neurological (AVPU)", value: "P", points: 2, clinical_note: "Responds only to painful stimuli (stupor)" };
    } else if (norm === "V" || norm === "VOICE") {
      return { parameter: "Neurological (AVPU)", value: "V", points: 1, clinical_note: "Responds only to voice stimuli (drowsy/confused)" };
    } else {
      return { parameter: "Neurological (AVPU)", value: "A", points: 0, clinical_note: "Fully alert and oriented" };
    }
  }

  static scoreMultimodal(vitals: PatientVitalsData): ScoreFactor[] {
    const modifiers: ScoreFactor[] = [];

    // Pallor modifier
    const pGrade = (vitals.conjunctival_pallor_grade || "normal").toLowerCase();
    if (pGrade === "severe") {
      modifiers.push({
        parameter: "Vision: Pallor",
        value: "Severe",
        points: 3,
        clinical_note: "AI Vision: Severe conjunctival pallor (Est. Hb < 7.0 g/dL, acute anemia)",
      });
    } else if (pGrade === "moderate") {
      modifiers.push({
        parameter: "Vision: Pallor",
        value: "Moderate",
        points: 2,
        clinical_note: "AI Vision: Moderate conjunctival pallor (Est. Hb 7.0-9.5 g/dL)",
      });
    } else if (pGrade === "mild") {
      modifiers.push({
        parameter: "Vision: Pallor",
        value: "Mild",
        points: 1,
        clinical_note: "AI Vision: Mild conjunctival pallor (Est. Hb 9.5-11.0 g/dL)",
      });
    } else {
      modifiers.push({
        parameter: "Vision: Pallor",
        value: "Normal",
        points: 0,
        clinical_note: "AI Vision: Healthy vascularization in palpebral conjunctiva",
      });
    }

    // Derm modifier
    const dGrade = (vitals.rash_or_wound_severity || "none").toLowerCase();
    if (dGrade === "deep_wound") {
      modifiers.push({
        parameter: "Vision: Dermatology",
        value: "Deep Wound / Necrotic",
        points: 3,
        clinical_note: "AI Vision: Deep ulceration or necrotizing tissue margins",
      });
    } else if (dGrade === "spreading_erythema") {
      modifiers.push({
        parameter: "Vision: Dermatology",
        value: "Spreading Erythema",
        points: 2,
        clinical_note: "AI Vision: Rapidly spreading erythematous rash (cellulitis risk)",
      });
    } else if (dGrade === "superficial") {
      modifiers.push({
        parameter: "Vision: Dermatology",
        value: "Superficial",
        points: 0,
        clinical_note: "AI Vision: Minor superficial abrasion or local dermatosis",
      });
    } else {
      modifiers.push({
        parameter: "Vision: Dermatology",
        value: "None",
        points: 0,
        clinical_note: "AI Vision: Intact skin integrity",
      });
    }

    // Speech NLP Red Flag
    if (vitals.speech_red_flag) {
      modifiers.push({
        parameter: "Speech NLP: Flag",
        value: "Red Flag Detected",
        points: 1,
        clinical_note: "Vernacular audio indicates acute red-flag phrase (e.g., syncope, hemoptysis, severe chest tightness)",
      });
    }

    return modifiers;
  }

  static evaluate(vitals: PatientVitalsData): TriageResult {
    const factors: ScoreFactor[] = [
      this.scoreSbp(vitals.systolic_bp),
      this.scoreHr(vitals.heart_rate),
      this.scoreRr(vitals.respiratory_rate),
      this.scoreTemp(vitals.temperature_c),
      this.scoreAvpu(vitals.avpu),
    ];

    const vitalsSubtotal = factors.reduce((sum, f) => sum + f.points, 0);
    const modifiers = this.scoreMultimodal(vitals);
    const modifierSubtotal = modifiers.reduce((sum, m) => sum + m.points, 0);
    const allFactors = [...factors, ...modifiers];

    const totalMews = vitalsSubtotal + modifierSubtotal;

    const avpuVal = String(vitals.avpu).toUpperCase();
    const isAvpuExtreme = avpuVal === "P" || avpuVal === "PAIN" || avpuVal === "U" || avpuVal === "UNRESPONSIVE";

    let tier: TriageTier;
    let color: string;
    let action: string;

    if (totalMews >= 6 || isAvpuExtreme) {
      tier = TriageTier.RED;
      color = "#DC2626";
      action = "IMMEDIATE ESCALATION: Tele-queue position #1, initiate 108 emergency transfer readiness.";
    } else if (totalMews >= 4) {
      tier = TriageTier.ORANGE;
      color = "#EA580C";
      action = "URGENT CONSULTATION: Doctor review within 15 mins, repeat vitals every 15 mins.";
    } else if (totalMews >= 2) {
      tier = TriageTier.YELLOW;
      color = "#CA8A04";
      action = "MODERATE PRIORITY: Tele-doctor review within 45 mins, nurse supportive care.";
    } else {
      tier = TriageTier.GREEN;
      color = "#16A34A";
      action = "ROUTINE: Retain standard FIFO queue, general tele-consultation.";
    }

    const escalatingDrivers = allFactors
      .filter((f) => f.points >= 2)
      .map((f) => `${f.parameter} (${f.value})`);
    const driversText = escalatingDrivers.length > 0 ? escalatingDrivers.join(", ") : "No acute physiological extremes";

    const sbar: SBARSummary = {
      Situation: `Patient presents with composite MEWS of ${totalMews} (${tier}). Primary complaint: ${vitals.chief_complaint || "Acute clinical distress"}.`,
      Background: `Vitals: BP ${vitals.systolic_bp}/${vitals.diastolic_bp || 80} mmHg, HR ${vitals.heart_rate} bpm, RR ${vitals.respiratory_rate} bpm, Temp ${vitals.temperature_c.toFixed(1)} °C, SpO2 ${vitals.spo2 || 98}%, AVPU: ${avpuVal}.`,
      Assessment: `Primary deterioration risk drivers: ${driversText}. Multimodal AI modifiers: Pallor (${vitals.conjunctival_pallor_grade || "normal"}), Derm (${vitals.rash_or_wound_severity || "none"}), Red-Flag (${vitals.speech_red_flag ? "Yes" : "No"}).`,
      Recommendation: action,
    };

    const fhirBundle = this.generateFhirBundle(vitals, totalMews, tier, sbar);

    return {
      total_score: totalMews,
      vitals_score: vitalsSubtotal,
      multimodal_modifier_score: modifierSubtotal,
      tier,
      color_code: color,
      action_protocol: action,
      breakdown: allFactors,
      sbar_summary: sbar,
      fhir_bundle: fhirBundle,
    };
  }

  static generateFhirBundle(vitals: PatientVitalsData, score: number, tier: TriageTier, sbar: SBARSummary): any {
    return {
      resourceType: "Bundle",
      type: "collection",
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: "ClinicalImpression",
            id: `triage-impression-${(vitals.abha_id || "20260915-001").replace(/\//g, "-")}`,
            status: "completed",
            subject: {
              reference: `Patient/${vitals.abha_id || "ABHA-91-8273-1029-44"}`,
              display: vitals.patient_name || "Sunita Devi",
            },
            investigation: [
              {
                code: { text: "Multimodal Rural Pre-Diagnosis Triage" },
                item: [
                  { display: `Voice ASR: ${vitals.chief_complaint || "Acute clinical symptoms"}` },
                  { display: `Vision Biomarker: Conjunctiva pallor grade '${vitals.conjunctival_pallor_grade || "normal"}'` },
                  { display: `Dermatology: Skin status '${vitals.rash_or_wound_severity || "none"}'` },
                  { display: `Physiological Vitals: BP ${vitals.systolic_bp}/${vitals.diastolic_bp || 80} mmHg, HR ${vitals.heart_rate} bpm, SpO2 ${vitals.spo2 || 98}%, Temp ${vitals.temperature_c.toFixed(1)} °C, AVPU ${vitals.avpu}` },
                ],
              },
            ],
            summary: `${sbar.Assessment} Composite MEWS: ${score} (${tier}). ${sbar.Recommendation}`,
            finding: [
              {
                itemCodeableConcept: {
                  coding: [
                    {
                      system: "http://snomed.info/sct",
                      code: "443694000",
                      display: "Early warning score",
                    },
                  ],
                  text: `MEWS Score ${score}`,
                },
              },
            ],
          },
        },
      ],
    };
  }
}

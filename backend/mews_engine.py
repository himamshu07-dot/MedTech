"""
TriageSetu Deterministic Modified Early Warning Score (MEWS) Engine
Classification: CDSCO SaMD Class B Clinical Decision Support System (Assistive Human-in-the-Loop)
Standard: Ayushman Bharat Digital Mission (ABDM) / HL7 FHIR R4

Deterministic, zero-hallucination physiological scoring engine with bounded AI multimodal modifiers:
  Composite MEWS = MEWS_vitals + delta_pallor + delta_dermatology + delta_speech_urgency
"""

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Dict, List, Optional, Any
import json


class AVPU(str, Enum):
    ALERT = "A"
    VOICE = "V"
    PAIN = "P"
    UNRESPONSIVE = "U"


class TriageTier(str, Enum):
    GREEN = "Green (Routine)"
    YELLOW = "Yellow (Moderate / Semi-Urgent)"
    ORANGE = "Orange (Urgent Priority)"
    RED = "Red (Critical / Emergency)"


@dataclass
class PatientVitals:
    systolic_bp: int
    heart_rate: int
    respiratory_rate: int
    temperature_c: float
    avpu: AVPU
    diastolic_bp: Optional[int] = 80
    spo2: Optional[int] = 98
    conjunctival_pallor_grade: Optional[str] = "normal"  # normal, mild, moderate, severe
    rash_or_wound_severity: Optional[str] = "none"       # none, superficial, spreading_erythema, deep_wound
    speech_red_flag: bool = False                        # syncope, chest pain, hemoptysis, severe dyspnea
    chief_complaint: Optional[str] = ""
    patient_name: Optional[str] = "Anonymous Patient"
    abha_id: Optional[str] = "ABHA-91-8273-1029-44"
    age: Optional[int] = 45
    gender: Optional[str] = "Female"


@dataclass
class ScoreFactor:
    parameter: str
    value: str
    points: int
    clinical_note: str


@dataclass
class TriageResult:
    total_score: int
    vitals_score: int
    multimodal_modifier_score: int
    tier: TriageTier
    color_code: str
    action_protocol: str
    breakdown: List[ScoreFactor] = field(default_factory=list)
    sbar_summary: Dict[str, str] = field(default_factory=dict)
    fhir_bundle: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["tier"] = self.tier.value
        return d


class ExplainableMEWSEngine:
    """
    Deterministic & Explainable MEWS Engine with Subbe et al. baseline
    augmented with bounded edge-vision and vernacular speech red-flag modifiers.
    """

    @staticmethod
    def _score_sbp(sbp: int) -> ScoreFactor:
        if sbp <= 70:
            return ScoreFactor("Systolic BP", f"{sbp} mmHg", 3, "Severe hypotension (shock risk)")
        elif 71 <= sbp <= 80:
            return ScoreFactor("Systolic BP", f"{sbp} mmHg", 2, "Moderate hypotension")
        elif 81 <= sbp <= 100:
            return ScoreFactor("Systolic BP", f"{sbp} mmHg", 1, "Mild borderline hypotension")
        elif 101 <= sbp <= 199:
            return ScoreFactor("Systolic BP", f"{sbp} mmHg", 0, "Normal hemodynamic range")
        else:
            return ScoreFactor("Systolic BP", f"{sbp} mmHg", 2, "Severe hypertensive crisis")

    @staticmethod
    def _score_hr(hr: int) -> ScoreFactor:
        if hr <= 40:
            return ScoreFactor("Heart Rate", f"{hr} bpm", 2, "Severe bradycardia")
        elif 41 <= hr <= 50:
            return ScoreFactor("Heart Rate", f"{hr} bpm", 1, "Moderate bradycardia")
        elif 51 <= hr <= 100:
            return ScoreFactor("Heart Rate", f"{hr} bpm", 0, "Normal rate")
        elif 101 <= hr <= 110:
            return ScoreFactor("Heart Rate", f"{hr} bpm", 1, "Mild tachycardia")
        elif 111 <= hr <= 129:
            return ScoreFactor("Heart Rate", f"{hr} bpm", 2, "Moderate tachycardia")
        else:
            return ScoreFactor("Heart Rate", f"{hr} bpm", 3, "Severe tachycardia (pre-decompensation)")

    @staticmethod
    def _score_rr(rr: int) -> ScoreFactor:
        if rr <= 8:
            return ScoreFactor("Respiratory Rate", f"{rr} bpm", 2, "Severe bradypnea (hypoventilation)")
        elif 9 <= rr <= 14:
            return ScoreFactor("Respiratory Rate", f"{rr} bpm", 0, "Normal respiratory pattern")
        elif 15 <= rr <= 20:
            return ScoreFactor("Respiratory Rate", f"{rr} bpm", 1, "Mild tachypnea")
        elif 21 <= rr <= 29:
            return ScoreFactor("Respiratory Rate", f"{rr} bpm", 2, "Moderate tachypnea")
        else:
            return ScoreFactor("Respiratory Rate", f"{rr} bpm", 3, "Severe respiratory distress")

    @staticmethod
    def _score_temp(temp: float) -> ScoreFactor:
        if temp <= 35.0:
            return ScoreFactor("Temperature", f"{temp:.1f} °C", 2, "Hypothermia")
        elif 35.1 <= temp <= 37.4:
            return ScoreFactor("Temperature", f"{temp:.1f} °C", 0, "Normothermia")
        elif 37.5 <= temp <= 38.4:
            return ScoreFactor("Temperature", f"{temp:.1f} °C", 1, "Low-grade pyrexia")
        else:
            return ScoreFactor("Temperature", f"{temp:.1f} °C", 2, "High pyrexia (sepsis/infection indicator)")

    @staticmethod
    def _score_avpu(avpu: AVPU) -> ScoreFactor:
        scores = {
            AVPU.ALERT: (0, "Fully alert and oriented"),
            AVPU.VOICE: (1, "Responds only to voice stimuli (drowsy/confused)"),
            AVPU.PAIN: (2, "Responds only to painful stimuli (stupor)"),
            AVPU.UNRESPONSIVE: (3, "Unresponsive (coma/acute cerebral hypoperfusion)")
        }
        pts, note = scores.get(avpu, (0, "Alert"))
        return ScoreFactor("Neurological (AVPU)", avpu.value, pts, note)

    @staticmethod
    def _score_multimodal_modifiers(vitals: PatientVitals) -> List[ScoreFactor]:
        modifiers: List[ScoreFactor] = []

        # 1. Ocular Conjunctival Pallor (CIELAB a* / Erythema Index)
        pallor_map = {
            "severe": (3, "AI Vision: Severe conjunctival pallor (Est. Hb < 7.0 g/dL, acute anemia)"),
            "moderate": (2, "AI Vision: Moderate conjunctival pallor (Est. Hb 7.0-9.5 g/dL)"),
            "mild": (1, "AI Vision: Mild conjunctival pallor (Est. Hb 9.5-11.0 g/dL)"),
            "normal": (0, "AI Vision: Healthy vascularization in palpebral conjunctiva")
        }
        if vitals.conjunctival_pallor_grade:
            pts, note = pallor_map.get(vitals.conjunctival_pallor_grade.lower(), (0, "Unclassified pallor"))
            modifiers.append(ScoreFactor("Vision: Pallor", vitals.conjunctival_pallor_grade, pts, note))

        # 2. Dermatology Wound / Spreading Erythema
        skin_map = {
            "deep_wound": (3, "AI Vision: Deep ulceration or necrotizing tissue margins"),
            "spreading_erythema": (2, "AI Vision: Rapidly spreading erythematous rash (cellulitis risk)"),
            "superficial": (0, "AI Vision: Minor superficial abrasion or local dermatosis"),
            "none": (0, "AI Vision: Intact skin integrity")
        }
        if vitals.rash_or_wound_severity:
            pts, note = skin_map.get(vitals.rash_or_wound_severity.lower(), (0, "Unclassified wound"))
            modifiers.append(ScoreFactor("Vision: Dermatology", vitals.rash_or_wound_severity, pts, note))

        # 3. Speech NLP Red-Flag Phrase
        if vitals.speech_red_flag:
            modifiers.append(ScoreFactor(
                "Speech NLP: Flag", "Red Flag Detected", 1,
                "Vernacular audio indicates acute red-flag phrase (e.g., syncope, hemoptysis, severe chest tightness)"
            ))

        return modifiers

    @classmethod
    def evaluate(cls, vitals: PatientVitals) -> TriageResult:
        factors: List[ScoreFactor] = [
            cls._score_sbp(vitals.systolic_bp),
            cls._score_hr(vitals.heart_rate),
            cls._score_rr(vitals.respiratory_rate),
            cls._score_temp(vitals.temperature_c),
            cls._score_avpu(vitals.avpu)
        ]
        vitals_subtotal = sum(f.points for f in factors)
        modifier_factors = cls._score_multimodal_modifiers(vitals)
        modifier_subtotal = sum(m.points for m in modifier_factors)
        factors.extend(modifier_factors)

        total_mews = vitals_subtotal + modifier_subtotal

        # Decision rules: Red Tier if Score >= 6 OR AVPU in [P, U]
        if total_mews >= 6 or vitals.avpu in [AVPU.PAIN, AVPU.UNRESPONSIVE]:
            tier = TriageTier.RED
            color = "#DC2626"
            action = "IMMEDIATE ESCALATION: Tele-queue position #1, initiate 108 emergency transfer readiness."
        elif 4 <= total_mews <= 5:
            tier = TriageTier.ORANGE
            color = "#EA580C"
            action = "URGENT CONSULTATION: Doctor review within 15 mins, repeat vitals every 15 mins."
        elif 2 <= total_mews <= 3:
            tier = TriageTier.YELLOW
            color = "#CA8A04"
            action = "MODERATE PRIORITY: Tele-doctor review within 45 mins, nurse supportive care."
        else:
            tier = TriageTier.GREEN
            color = "#16A34A"
            action = "ROUTINE: Retain standard FIFO queue, general tele-consultation."

        escalating_drivers = [f"{f.parameter} ({f.value})" for f in factors if f.points >= 2]
        drivers_text = ", ".join(escalating_drivers) if escalating_drivers else "No acute physiological extremes"

        sbar = {
            "Situation": f"Patient presents with composite MEWS of {total_mews} ({tier.value}). Primary complaint: {vitals.chief_complaint or 'Acute clinical distress'}.",
            "Background": (
                f"Vitals: BP {vitals.systolic_bp}/{vitals.diastolic_bp or 80} mmHg, HR {vitals.heart_rate} bpm, "
                f"RR {vitals.respiratory_rate} bpm, Temp {vitals.temperature_c:.1f} °C, SpO2 {vitals.spo2 or 98}%, AVPU: {vitals.avpu.value}."
            ),
            "Assessment": f"Primary deterioration risk drivers: {drivers_text}. Multimodal AI modifiers: Pallor ({vitals.conjunctival_pallor_grade}), Derm ({vitals.rash_or_wound_severity}), Red-Flag ({'Yes' if vitals.speech_red_flag else 'No'}).",
            "Recommendation": action
        }

        # Build FHIR R4 ClinicalImpression Bundle
        fhir_bundle = cls.generate_fhir_bundle(vitals, total_mews, tier, sbar)

        return TriageResult(
            total_score=total_mews,
            vitals_score=vitals_subtotal,
            multimodal_modifier_score=modifier_subtotal,
            tier=tier,
            color_code=color,
            action_protocol=action,
            breakdown=factors,
            sbar_summary=sbar,
            fhir_bundle=fhir_bundle
        )

    @classmethod
    def generate_fhir_bundle(cls, vitals: PatientVitals, score: int, tier: TriageTier, sbar: Dict[str, str]) -> Dict[str, Any]:
        return {
            "resourceType": "Bundle",
            "type": "collection",
            "timestamp": "2026-09-15T10:30:00Z",
            "entry": [
                {
                    "resource": {
                        "resourceType": "ClinicalImpression",
                        "id": f"triage-impression-{vitals.abha_id.replace('/', '-') if vitals.abha_id else '20260915-001'}",
                        "status": "completed",
                        "subject": {
                            "reference": f"Patient/{vitals.abha_id or 'ABHA-91-8273-1029-44'}",
                            "display": vitals.patient_name or "Sunita Devi"
                        },
                        "investigation": [
                            {
                                "code": { "text": "Multimodal Rural Pre-Diagnosis Triage" },
                                "item": [
                                    { "display": f"Voice ASR: {vitals.chief_complaint or 'Patient reported acute symptoms'}" },
                                    { "display": f"Vision Biomarker: Conjunctiva pallor grade '{vitals.conjunctival_pallor_grade}'" },
                                    { "display": f"Dermatology: Skin status '{vitals.rash_or_wound_severity}'" },
                                    { "display": f"Physiological Vitals: BP {vitals.systolic_bp}/{vitals.diastolic_bp or 80} mmHg, HR {vitals.heart_rate} bpm, SpO2 {vitals.spo2 or 98}%, Temp {vitals.temperature_c:.1f} °C, AVPU {vitals.avpu.value}" }
                                ]
                            }
                        ],
                        "summary": f"{sbar['Assessment']} Composite MEWS: {score} ({tier.value}). {sbar['Recommendation']}",
                        "finding": [
                            {
                                "itemCodeableConcept": {
                                    "coding": [
                                        {
                                            "system": "http://snomed.info/sct",
                                            "code": "443694000",
                                            "display": "Early warning score"
                                        }
                                    ],
                                    "text": f"MEWS Score {score}"
                                }
                            }
                        ]
                    }
                }
            ]
        }


# Example Execution matching Section 9
if __name__ == "__main__":
    patient = PatientVitals(
        systolic_bp=82,
        heart_rate=122,
        respiratory_rate=24,
        temperature_c=38.8,
        avpu=AVPU.VOICE,
        conjunctival_pallor_grade="severe",
        rash_or_wound_severity="spreading_erythema",
        speech_red_flag=True,
        chief_complaint="Subah se kaleje mein teekha dard aur ulti ho rahi hai",
        patient_name="Sunita Devi",
        abha_id="ABHA-91-8273-1029-44"
    )
    result = ExplainableMEWSEngine.evaluate(patient)
    print(f"TRIAGE TIER: {result.tier.value} | TOTAL MEWS: {result.total_score}")
    print(json.dumps(result.sbar_summary, indent=2))

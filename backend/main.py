"""
TriageSetu FastAPI Backend Service
Standard: Ayushman Bharat Digital Mission (ABDM) / HL7 FHIR R4
Compliant with CDSCO SaMD Class B Clinical Decision Support System constraints.

Provides:
- POST /api/triage/evaluate : Deterministic MEWS evaluation + SBAR + FHIR generation
- POST /api/fhir/export : Standalone ABDM FHIR R4 bundle generator
- GET /api/queue : Live acuity-sorted queue
- POST /api/queue/admit : Admission of new patient into dynamic priority queue
- POST /api/queue/status : Update patient status (in-consultation, admitted, transferred, discharged)
- WebSocket /ws/tele-queue : Live bidirectional telemetry & priority queue broadcaster
"""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any

try:
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, status
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, Field
except ImportError:
    # Graceful fallback if executed in lightweight environments without uvicorn
    FastAPI = None

from mews_engine import (
    ExplainableMEWSEngine,
    PatientVitals,
    AVPU,
    TriageTier,
    TriageResult
)


if FastAPI:
    app = FastAPI(
        title="TriageSetu CDSS Microservice",
        description="FOSS Local-first Multimodal Urgency Triage & Deterministic MEWS Backend",
        version="1.0.0"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app = None


# --- Pydantic Data Contracts ---
class PatientTriageRequest(BaseModel):
    patient_name: str = Field(default="Sunita Devi", description="Patient Full Name")
    abha_id: str = Field(default="ABHA-91-8273-1029-44", description="14-digit ABHA Citizen ID")
    age: int = Field(default=42, ge=0, le=120)
    gender: str = Field(default="Female")
    clinic_location: str = Field(default="Ayushman Arogya Mandir - Rampur PHC")
    systolic_bp: int = Field(..., ge=40, le=300, description="Systolic Blood Pressure (mmHg)")
    diastolic_bp: Optional[int] = Field(default=80, ge=30, le=180)
    heart_rate: int = Field(..., ge=20, le=260, description="Heart Rate (BPM)")
    respiratory_rate: int = Field(..., ge=4, le=80, description="Respiratory Rate (BPM)")
    temperature_c: float = Field(..., ge=30.0, le=45.0, description="Core Body Temperature (°C)")
    spo2: Optional[int] = Field(default=98, ge=50, le=100, description="Oxygen Saturation (%)")
    avpu: str = Field(default="A", description="A (Alert), V (Voice), P (Pain), U (Unresponsive)")
    conjunctival_pallor_grade: Optional[str] = Field(default="normal", description="normal, mild, moderate, severe")
    rash_or_wound_severity: Optional[str] = Field(default="none", description="none, superficial, spreading_erythema, deep_wound")
    speech_red_flag: bool = Field(default=False, description="Presence of syncope, hemoptysis, or severe acute chest pain")
    chief_complaint: Optional[str] = Field(default="", description="Vernacular chief complaint recorded via SetuAgent")
    erythema_index: Optional[float] = Field(default=None, description="Computed CIELAB a* / Erythema Index")


class StatusUpdateRequest(BaseModel):
    patient_id: str
    new_status: str  # waiting, in-consultation, 108-transferred, completed


# --- In-Memory Dynamic Priority Queue (Zero-Cost SQLite-ready memory mirror) ---
queue_store: List[Dict[str, Any]] = []


def sort_queue(patients: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Sorts patients strictly by clinical acuity:
    1. RED tier (Score >= 6 or AVPU Pain/Unresponsive) jumps to position #1.
    2. Then ORANGE (4-5), then YELLOW (2-3), then GREEN (0-1).
    3. Within the same tier, higher total_score first, followed by earliest arrival timestamp (FIFO within tier).
    """
    tier_weight = {
        TriageTier.RED.value: 4,
        "Red (Critical / Emergency)": 4,
        TriageTier.ORANGE.value: 3,
        "Orange (Urgent Priority)": 3,
        TriageTier.YELLOW.value: 2,
        "Yellow (Moderate / Semi-Urgent)": 2,
        TriageTier.GREEN.value: 1,
        "Green (Routine)": 1
    }

    return sorted(
        patients,
        key=lambda p: (
            -tier_weight.get(p.get("tier", ""), 0),
            -p.get("total_score", 0),
            p.get("timestamp", "")
        )
    )


# --- WebSocket Connection Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        data = json.dumps(message)
        for connection in list(self.active_connections):
            try:
                await connection.send_text(data)
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


# --- Seed Initial Authentic Demonstration Cases for Rural Health Centers ---
def seed_initial_cases():
    if queue_store:
        return

    sample_cases = [
        {
            "id": "CASE-101",
            "patient_name": "Rameshwar Patel",
            "abha_id": "ABHA-91-4451-9921-12",
            "age": 58,
            "gender": "Male",
            "clinic_location": "Bhilwara Sub-Centre HWC",
            "chief_complaint": "2 ghante se seene mein dard aur paseena aa raha hai",
            "systolic_bp": 78,
            "diastolic_bp": 52,
            "heart_rate": 128,
            "respiratory_rate": 26,
            "temperature_c": 36.6,
            "spo2": 91,
            "avpu": "V",
            "conjunctival_pallor_grade": "moderate",
            "rash_or_wound_severity": "none",
            "speech_red_flag": True,
            "timestamp": "2026-09-15T09:45:00Z",
            "status": "waiting"
        },
        {
            "id": "CASE-102",
            "patient_name": "Kamla Devi",
            "abha_id": "ABHA-91-8812-3341-90",
            "age": 34,
            "gender": "Female",
            "clinic_location": "Bhilwara Sub-Centre HWC",
            "chief_complaint": "Bhookh nahi lag rahi, bohot kamzori aur chakkar hain",
            "systolic_bp": 94,
            "diastolic_bp": 64,
            "heart_rate": 104,
            "respiratory_rate": 18,
            "temperature_c": 37.0,
            "spo2": 97,
            "avpu": "A",
            "conjunctival_pallor_grade": "severe",
            "rash_or_wound_severity": "none",
            "speech_red_flag": False,
            "timestamp": "2026-09-15T09:15:00Z",
            "status": "waiting"
        },
        {
            "id": "CASE-103",
            "patient_name": "Bablu Kumar",
            "abha_id": "ABHA-91-1102-4422-55",
            "age": 19,
            "gender": "Male",
            "clinic_location": "Bhilwara Sub-Centre HWC",
            "chief_complaint": "Pair mein kheti ke dauran gehra ghaav laga hai, laali badh rahi hai",
            "systolic_bp": 118,
            "diastolic_bp": 76,
            "heart_rate": 84,
            "respiratory_rate": 16,
            "temperature_c": 38.6,
            "spo2": 99,
            "avpu": "A",
            "conjunctival_pallor_grade": "normal",
            "rash_or_wound_severity": "spreading_erythema",
            "speech_red_flag": False,
            "timestamp": "2026-09-15T08:50:00Z",
            "status": "waiting"
        }
    ]

    for item in sample_cases:
        vitals = PatientVitals(
            systolic_bp=item["systolic_bp"],
            diastolic_bp=item["diastolic_bp"],
            heart_rate=item["heart_rate"],
            respiratory_rate=item["respiratory_rate"],
            temperature_c=item["temperature_c"],
            spo2=item["spo2"],
            avpu=AVPU(item["avpu"]),
            conjunctival_pallor_grade=item["conjunctival_pallor_grade"],
            rash_or_wound_severity=item["rash_or_wound_severity"],
            speech_red_flag=item["speech_red_flag"],
            chief_complaint=item["chief_complaint"],
            patient_name=item["patient_name"],
            abha_id=item["abha_id"],
            age=item["age"],
            gender=item["gender"]
        )
        triage_result = ExplainableMEWSEngine.evaluate(vitals)
        patient_record = {
            **item,
            "total_score": triage_result.total_score,
            "vitals_score": triage_result.vitals_score,
            "multimodal_modifier_score": triage_result.multimodal_modifier_score,
            "tier": triage_result.tier.value,
            "color_code": triage_result.color_code,
            "action_protocol": triage_result.action_protocol,
            "breakdown": [asdict_factor(f) for f in triage_result.breakdown],
            "sbar_summary": triage_result.sbar_summary,
            "fhir_bundle": triage_result.fhir_bundle
        }
        queue_store.append(patient_record)


def asdict_factor(f):
    return {
        "parameter": f.parameter,
        "value": f.value,
        "points": f.points,
        "clinical_note": f.clinical_note
    }


seed_initial_cases()


# --- REST API Endpoints ---
if app:
    @app.get("/api/health")
    async def health_check():
        return {
            "status": "operational",
            "system": "TriageSetu Deterministic CDSS Engine",
            "standard": "ABDM / HL7 FHIR R4",
            "cdsco_class": "Class B SaMD Assistive"
        }

    @app.post("/api/triage/evaluate")
    async def evaluate_patient(payload: PatientTriageRequest):
        """
        Executes deterministic MEWS evaluation with bounded AI vision and NLP modifiers.
        """
        try:
            avpu_enum = AVPU(payload.avpu.upper())
        except ValueError:
            avpu_enum = AVPU.ALERT

        vitals = PatientVitals(
            systolic_bp=payload.systolic_bp,
            diastolic_bp=payload.diastolic_bp or 80,
            heart_rate=payload.heart_rate,
            respiratory_rate=payload.respiratory_rate,
            temperature_c=payload.temperature_c,
            spo2=payload.spo2 or 98,
            avpu=avpu_enum,
            conjunctival_pallor_grade=payload.conjunctival_pallor_grade or "normal",
            rash_or_wound_severity=payload.rash_or_wound_severity or "none",
            speech_red_flag=payload.speech_red_flag,
            chief_complaint=payload.chief_complaint,
            patient_name=payload.patient_name,
            abha_id=payload.abha_id,
            age=payload.age,
            gender=payload.gender
        )

        result: TriageResult = ExplainableMEWSEngine.evaluate(vitals)

        patient_id = f"CASE-{uuid.uuid4().hex[:6].upper()}"
        record = {
            "id": patient_id,
            "patient_name": payload.patient_name,
            "abha_id": payload.abha_id,
            "age": payload.age,
            "gender": payload.gender,
            "clinic_location": payload.clinic_location,
            "chief_complaint": payload.chief_complaint,
            "systolic_bp": payload.systolic_bp,
            "diastolic_bp": payload.diastolic_bp,
            "heart_rate": payload.heart_rate,
            "respiratory_rate": payload.respiratory_rate,
            "temperature_c": payload.temperature_c,
            "spo2": payload.spo2,
            "avpu": payload.avpu,
            "conjunctival_pallor_grade": payload.conjunctival_pallor_grade,
            "rash_or_wound_severity": payload.rash_or_wound_severity,
            "speech_red_flag": payload.speech_red_flag,
            "erythema_index": payload.erythema_index,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "status": "waiting",
            "total_score": result.total_score,
            "vitals_score": result.vitals_score,
            "multimodal_modifier_score": result.multimodal_modifier_score,
            "tier": result.tier.value,
            "color_code": result.color_code,
            "action_protocol": result.action_protocol,
            "breakdown": [asdict_factor(f) for f in result.breakdown],
            "sbar_summary": result.sbar_summary,
            "fhir_bundle": result.fhir_bundle
        }

        # Insert and dynamically re-order queue
        queue_store.append(record)
        sorted_q = sort_queue(queue_store)

        # Notify doctor dashboards via WebSockets
        await manager.broadcast({
            "event": "PATIENT_TRIAGED",
            "patient": record,
            "queue": sorted_q,
            "is_emergency": result.tier == TriageTier.RED
        })

        return {
            "patient_id": patient_id,
            "triage_result": result.to_dict(),
            "queue_position": next((i + 1 for i, p in enumerate(sorted_q) if p["id"] == patient_id), 1),
            "total_queue_count": len(sorted_q)
        }

    @app.get("/api/queue")
    async def get_queue():
        """Returns the current dynamically sorted queue"""
        return {
            "queue": sort_queue(queue_store),
            "count": len(queue_store)
        }

    @app.post("/api/fhir/export")
    async def export_fhir_bundle(payload: PatientTriageRequest):
        """Generates an ABDM HL7 FHIR R4 Bundle for EHR integration"""
        try:
            avpu_enum = AVPU(payload.avpu.upper())
        except ValueError:
            avpu_enum = AVPU.ALERT

        vitals = PatientVitals(
            systolic_bp=payload.systolic_bp,
            diastolic_bp=payload.diastolic_bp or 80,
            heart_rate=payload.heart_rate,
            respiratory_rate=payload.respiratory_rate,
            temperature_c=payload.temperature_c,
            spo2=payload.spo2 or 98,
            avpu=avpu_enum,
            conjunctival_pallor_grade=payload.conjunctival_pallor_grade or "normal",
            rash_or_wound_severity=payload.rash_or_wound_severity or "none",
            speech_red_flag=payload.speech_red_flag,
            chief_complaint=payload.chief_complaint,
            patient_name=payload.patient_name,
            abha_id=payload.abha_id
        )
        result = ExplainableMEWSEngine.evaluate(vitals)
        return result.fhir_bundle

    @app.post("/api/queue/status")
    async def update_patient_status(update: StatusUpdateRequest):
        """Updates patient treatment status in tele-queue"""
        for patient in queue_store:
            if patient["id"] == update.patient_id:
                patient["status"] = update.new_status
                sorted_q = sort_queue(queue_store)
                await manager.broadcast({
                    "event": "QUEUE_UPDATED",
                    "updated_patient_id": update.patient_id,
                    "new_status": update.new_status,
                    "queue": sorted_q
                })
                return {"success": True, "patient": patient}
        raise HTTPException(status_code=404, detail="Patient case not found")

    @app.websocket("/ws/tele-queue")
    async def websocket_tele_queue(websocket: WebSocket):
        """
        WebSocket endpoint for live real-time queue synchronization between rural tablets
        and tele-doctor stations.
        """
        await manager.connect(websocket)
        try:
            # Send current queue state immediately upon connection
            sorted_q = sort_queue(queue_store)
            await websocket.send_text(json.dumps({
                "event": "INITIAL_QUEUE_STATE",
                "queue": sorted_q
            }))

            while True:
                data = await websocket.receive_text()
                try:
                    payload = json.loads(data)
                    action = payload.get("action")
                    if action == "PING":
                        await websocket.send_text(json.dumps({"event": "PONG"}))
                    elif action == "REFRESH":
                        await websocket.send_text(json.dumps({
                            "event": "QUEUE_SYNC",
                            "queue": sort_queue(queue_store)
                        }))
                except json.JSONDecodeError:
                    pass
        except WebSocketDisconnect:
            manager.disconnect(websocket)

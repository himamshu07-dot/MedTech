import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, VolumeX, ShieldAlert, Sparkles, AlertCircle, ArrowRight, RotateCcw, CheckCircle2, ChevronRight, Activity } from "lucide-react";

/**
 * SetuAgent: Autonomous Conversational Voice & Multimodal Intake Co-Pilot
 * CDSCO SaMD Class B Assistive CDSS
 * Zero external paid dependencies - Uses Web Speech API & browser-native speech synthesis
 */

// Dialect dictionary with colloquial mapping to medical concepts
const VERNACULAR_KNOWLEDGE_BASE = [
  {
    triggers: ["kaleje mein dard", "seene mein dard", "chhati mein dard", "chest pain", "kaleje", "seena"],
    concept: "Acute Retrosternal / Epigastric Pain",
    redFlag: true,
    clinicalTag: "Cardiac / ACS Risk",
    followUpHindi: "Kya yeh dard aapke baayein haath ya peeth ki taraf fail raha hai? Kya saans lene mein takleef hai?",
    followUpEng: "Does this pain radiate to your left arm or back? Are you having difficulty breathing?",
    suggestedVitals: { systolic_bp: 82, diastolic_bp: 54, heart_rate: 122, respiratory_rate: 24, speech_red_flag: true }
  },
  {
    triggers: ["chakkar", "behoshi", "fainting", "syncope", "giddiness", "chakar"],
    concept: "Syncope / Cerebral Hypoperfusion",
    redFlag: true,
    clinicalTag: "Neurological / Shock Risk",
    followUpHindi: "Yeh behoshi kitne samay tak rahi? Kya girte waqt chot lagi?",
    followUpEng: "How long did the unconsciousness last? Was there any trauma upon falling?",
    suggestedVitals: { systolic_bp: 86, heart_rate: 115, speech_red_flag: true }
  },
  {
    triggers: ["khoon", "blood", "hemoptysis", "khasi mein khoon", "vomiting blood", "khoon ki ulti"],
    concept: "Acute Hemoptysis / Hematemesis",
    redFlag: true,
    clinicalTag: "Active Hemorrhage",
    followUpHindi: "Kya ulti ya khansi mein taaza laal khoon aa raha hai?",
    followUpEng: "Is there fresh red blood in cough or vomit?",
    suggestedVitals: { heart_rate: 124, systolic_bp: 88, speech_red_flag: true }
  },
  {
    triggers: ["saans", "saans phool", "breath", "dyspnea", "dam phool", "saas"],
    concept: "Acute Dyspnea / Respiratory Distress",
    redFlag: true,
    clinicalTag: "Hypoxemic Stress",
    followUpHindi: "Kya baithne par saans theek hoti hai? Kya hoth neele pad rahe hain?",
    followUpEng: "Does breathing ease when sitting up? Are lips turning cyanotic?",
    suggestedVitals: { respiratory_rate: 28, spo2: 89, speech_red_flag: true }
  },
  {
    triggers: ["kamzori", "peela", "pale", "chakkar aana", "weakness", "pallor", "thakan"],
    concept: "Severe Fatigue & Anemia Suspicion",
    redFlag: false,
    clinicalTag: "Pallor / Anemia",
    followUpHindi: "Kya aankhein ya naakhun peele lag rahe hain? Yeh thakan kitne dinon se hai?",
    followUpEng: "Do the eyes or nails look pale? How many days has this fatigue persisted?",
    suggestedVitals: { conjunctival_pallor_grade: "severe", heart_rate: 104 }
  },
  {
    triggers: ["ghaav", "wound", "laali", "pus", "rash", "phoda", "infection"],
    concept: "Cutaneous Infection / Spreading Cellulitis",
    redFlag: false,
    clinicalTag: "Dermatological Margin",
    followUpHindi: "Kya ghaav ke aas paas ki tvacha garam aur sooji hui hai?",
    followUpEng: "Is the skin around the wound warm, erythematous, and swollen?",
    suggestedVitals: { rash_or_wound_severity: "spreading_erythema", temperature_c: 38.6 }
  },
  {
    triggers: ["bukhar", "fever", "tap", "thand", "shivering"],
    concept: "Pyrexia / Febrile Illness",
    redFlag: false,
    clinicalTag: "Infectious Pyrexia",
    followUpHindi: "Bukhar kitne dino se hai? Kya kapkapi ke saath aata hai?",
    followUpEng: "How many days of fever? Does it come with rigors or chills?",
    suggestedVitals: { temperature_c: 39.1, heart_rate: 112 }
  }
];

// Preset simulated patient audio scenarios for testing in rural clinics or offline demos
const PRESET_PATIENT_SCENARIOS = [
  {
    label: "Case A: Acute Chest Pain & Dizziness (Red Alert)",
    hindiText: "Subah se kaleje mein teekha dard ho raha hai, ulti aane jaisa lag raha hai aur chakkar aa raha hai.",
    englishDesc: "Severe retrosternal chest pain radiating with nausea and fainting sensation since morning.",
    tags: ["Chest Pain", "Dizziness", "Syncope Risk"],
    redFlag: true,
    vitals: { systolic_bp: 78, diastolic_bp: 52, heart_rate: 126, respiratory_rate: 25, temperature_c: 36.8, spo2: 91, avpu: "V", speech_red_flag: true }
  },
  {
    label: "Case B: Extreme Pallor & Fatigue (Severe Anemia)",
    hindiText: "Maa ko bohot dino se kamzori hai, aankhein peeli pad gayi hain aur chalte hi saans phoolti hai.",
    englishDesc: "Chronic extreme exhaustion, conjunctival pallor, and exertional shortness of breath.",
    tags: ["Severe Pallor", "Fatigue", "Dyspnea on Exertion"],
    redFlag: false,
    vitals: { systolic_bp: 96, diastolic_bp: 62, heart_rate: 108, respiratory_rate: 20, temperature_c: 37.1, spo2: 96, avpu: "A", conjunctival_pallor_grade: "severe", speech_red_flag: false }
  },
  {
    label: "Case C: Septic Cellulitis / Farm Wound",
    hindiText: "Khet mein lohe se gehra ghaav laga tha. Ab pair poora laal aur garam ho gaya hai aur tez bukhar hai.",
    englishDesc: "Deep farm injury with rapidly expanding erythema, edema, and high febrile state.",
    tags: ["Deep Wound", "Spreading Erythema", "High Pyrexia"],
    redFlag: false,
    vitals: { systolic_bp: 108, diastolic_bp: 68, heart_rate: 114, respiratory_rate: 22, temperature_c: 39.2, spo2: 97, avpu: "A", rash_or_wound_severity: "spreading_erythema", speech_red_flag: false }
  },
  {
    label: "Case D: Mild Cough & Routine Cold",
    hindiText: "Do din se halka zukaam aur khansi hai, sar mein thoda dard hai.",
    englishDesc: "Mild upper respiratory symptoms and low-grade tension headache for 2 days.",
    tags: ["Mild Cough", "Headache"],
    redFlag: false,
    vitals: { systolic_bp: 118, diastolic_bp: 76, heart_rate: 74, respiratory_rate: 14, temperature_c: 37.0, spo2: 99, avpu: "A", speech_red_flag: false }
  }
];

export default function SetuAgent({ onIntakeComplete, onProceedToVision, initialPatient }) {
  // Dialogue state machine: S0 -> S1 -> S2 -> S3 -> S4
  const [dialogueState, setDialogueState] = useState("S0");
  const [selectedLanguage, setSelectedLanguage] = useState("Hindi");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechMuted, setSpeechMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [agentResponseHindi, setAgentResponseHindi] = useState("Namaste. Kripya batayein mareez ko kya samasya ho rahi hai aur kabse hai?");
  const [agentResponseEng, setAgentResponseEng] = useState("Hello. Please state what symptoms the patient is experiencing and since when.");
  const [extractedChips, setExtractedChips] = useState([]);
  const [redFlagsDetected, setRedFlagsDetected] = useState([]);
  const [extractedVitalsDraft, setExtractedVitalsDraft] = useState({
    speech_red_flag: false,
    chief_complaint: "",
  });

  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  // Initialize Speech Synthesis
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // Speak agent message using Web Speech Synthesis API
  const speakText = (text) => {
    if (speechMuted || !synthRef.current) return;
    try {
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92; // slightly slower for elderly/rural clarity
      utterance.pitch = 1.0;
      utterance.lang = selectedLanguage === "Hindi" ? "hi-IN" : "en-IN";
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synthRef.current.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
      setIsSpeaking(false);
    }
  };

  // Setup Web Speech Recognition
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // Fallback message if speech recognition is unavailable in the environment
      alert("Web Speech API is not supported in this browser. Please use one of the one-tap vernacular scenario buttons below to test voice extraction!");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage === "Hindi" ? "hi-IN" : "en-IN";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (transcript.trim().length > 0) {
          processPatientUtterance(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error("SpeechRecognition start failed:", err);
      setIsListening(false);
    }
  };

  // Core NLP Parser & Dialect Entity Extractor
  const processPatientUtterance = (text, directVitals = null) => {
    const lower = text.toLowerCase();
    const foundChips = [...extractedChips];
    const foundRedFlags = [...redFlagsDetected];
    let matchedVitals = { ...(directVitals || {}) };
    let followUpH = "";
    let followUpE = "";
    let hasCriticalFlag = false;

    VERNACULAR_KNOWLEDGE_BASE.forEach((item) => {
      const matched = item.triggers.some((trigger) => lower.includes(trigger));
      if (matched) {
        if (!foundChips.includes(item.concept)) {
          foundChips.push(item.concept);
        }
        if (item.redFlag) {
          hasCriticalFlag = true;
          if (!foundRedFlags.includes(item.clinicalTag)) {
            foundRedFlags.push(item.clinicalTag);
          }
        }
        if (!followUpH) {
          followUpH = item.followUpHindi;
          followUpE = item.followUpEng;
        }
        if (item.suggestedVitals) {
          matchedVitals = { ...matchedVitals, ...item.suggestedVitals };
        }
      }
    });

    if (foundChips.length === 0) {
      foundChips.push("General Malaise / Symptom Logged");
    }

    setExtractedChips(foundChips);
    setRedFlagsDetected(foundRedFlags);

    const updatedDraft = {
      ...extractedVitalsDraft,
      ...matchedVitals,
      chief_complaint: text,
      speech_red_flag: hasCriticalFlag || (directVitals && directVitals.speech_red_flag),
    };
    setExtractedVitalsDraft(updatedDraft);

    // State machine progression
    if (dialogueState === "S0") {
      setDialogueState("S1");
      const respH = followUpH || "Yeh takleef kitne ghanton se hai? Kya behoshi ya khoon aane jaisi samasya hui hai?";
      const respE = followUpE || "How many hours has this persisted? Has there been any fainting or bleeding?";
      setAgentResponseHindi(respH);
      setAgentResponseEng(respE);
      speakText(respH);
    } else if (dialogueState === "S1") {
      setDialogueState("S2");
      const respH = "Sister, kripya mareez ki aankh ke nichle hisse ko reticle ke andar scan karein aur ghaav ki jaanch karein.";
      const respE = "Sister, please position the lower conjunctival mucosal bed inside the camera reticle.";
      setAgentResponseHindi(respH);
      setAgentResponseEng(respE);
      speakText(respH);
    }
  };

  const loadScenario = (scenario) => {
    setTranscript(scenario.hindiText);
    processPatientUtterance(scenario.hindiText, scenario.vitals);
  };

  const advanceToVision = () => {
    const finalData = {
      ...extractedVitalsDraft,
      extracted_symptoms: extractedChips,
      red_flags: redFlagsDetected,
      chief_complaint: transcript || "Patient reported symptoms during voice intake.",
    };
    if (onProceedToVision) {
      onProceedToVision(finalData);
    }
  };

  const resetIntake = () => {
    setDialogueState("S0");
    setTranscript("");
    setExtractedChips([]);
    setRedFlagsDetected([]);
    setExtractedVitalsDraft({ speech_red_flag: false, chief_complaint: "" });
    const initialH = "Namaste. Kripya batayein mareez ko kya samasya ho rahi hai aur kabse hai?";
    setAgentResponseHindi(initialH);
    setAgentResponseEng("Hello. Please state what symptoms the patient is experiencing and since when.");
    speakText(initialH);
  };

  return (
    <div id="setu-agent-container" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-xl">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-white">SetuAgent: Vernacular Voice Intake</h2>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Class B CDSS
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Offline-capable conversational co-pilot for rural ANMs & Community Health Officers
            </p>
          </div>
        </div>

        {/* Controls: Language Selector & Audio Mute */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700 text-xs">
            {["Hindi", "English", "Marathi", "Kannada"].map((lang) => (
              <button
                key={lang}
                id={`lang-btn-${lang.toLowerCase()}`}
                onClick={() => setSelectedLanguage(lang)}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  selectedLanguage === lang
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          <button
            id="mute-speech-btn"
            onClick={() => setSpeechMuted(!speechMuted)}
            title={speechMuted ? "Unmute Voice" : "Mute Voice"}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            {speechMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-teal-400" />}
          </button>
        </div>
      </div>

      {/* State Machine Status Ribbon */}
      <div className="my-4 flex items-center justify-between text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800">
        <span className="font-semibold text-slate-400 uppercase tracking-wider">Clinical Workflow State:</span>
        <div className="flex items-center gap-2">
          {[
            { id: "S0", label: "S0: Greeting" },
            { id: "S1", label: "S1: Red-Flag Query" },
            { id: "S2", label: "S2: Vision Assist" },
            { id: "S3", label: "S3: Vitals Telemetry" },
          ].map((st, idx) => (
            <span
              key={st.id}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                dialogueState === st.id
                  ? "bg-teal-500 text-slate-950 font-bold shadow-md ring-2 ring-teal-400/40"
                  : "bg-slate-800/60 text-slate-400"
              }`}
            >
              {st.label}
            </span>
          ))}
        </div>
      </div>

      {/* Main Interactive Stage: Waveform & Speech Recognition */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6">
        {/* Left: Waveform & Mic Trigger */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 bg-slate-950/80 rounded-2xl border border-slate-800 text-center relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div
            className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
              isListening ? "bg-teal-500/10 opacity-100" : isSpeaking ? "bg-blue-500/10 opacity-100" : "opacity-0"
            }`}
          />

          {/* Large Mic Touch Target (>= 48px standard, here 88px) */}
          <button
            id="mic-listen-btn"
            onClick={toggleListening}
            className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all transform active:scale-95 shadow-2xl ${
              isListening
                ? "bg-rose-600 text-white ring-8 ring-rose-500/30 animate-pulse"
                : "bg-gradient-to-tr from-teal-600 to-emerald-500 text-white hover:from-teal-500 hover:to-emerald-400 ring-4 ring-teal-500/20"
            }`}
          >
            {isListening ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
          </button>

          <p className="mt-4 text-sm font-semibold text-slate-200">
            {isListening ? "Listening to Patient Complaint..." : "Tap to Speak (ANM / Patient)"}
          </p>
          <span className="text-xs text-slate-400 mt-1">
            Web Speech API / Offline Indic Whisper Model
          </span>

          {/* Dynamic Audio Waveform Representation */}
          <div className="flex items-center justify-center gap-1.5 h-10 mt-5 w-full">
            {[40, 65, 85, 45, 95, 70, 30, 80, 60, 90, 50, 75, 40].map((h, i) => (
              <div
                key={i}
                className={`w-1.5 rounded-full transition-all duration-150 ${
                  isListening
                    ? "bg-rose-400 animate-pulse"
                    : isSpeaking
                    ? "bg-teal-400 animate-pulse"
                    : "bg-slate-700"
                }`}
                style={{
                  height: isListening || isSpeaking ? `${Math.max(12, (h * Math.random()).toFixed(0))}px` : "8px",
                }}
              />
            ))}
          </div>

          {/* Re-prompt / Reset Button */}
          <button
            id="reset-intake-btn"
            onClick={resetIntake}
            className="mt-5 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Intake Dialogue
          </button>
        </div>

        {/* Right: Dual-Text Dialogue Box & Extracted Biomarker Chips */}
        <div className="lg:col-span-7 flex flex-col justify-between p-6 bg-slate-950/80 rounded-2xl border border-slate-800">
          <div>
            {/* SetuAgent Assistant Speech Bubble */}
            <div className="p-4 rounded-xl bg-teal-950/40 border border-teal-800/50 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> SetuAgent (Frontline Voice Co-Pilot)
                </span>
                {isSpeaking && (
                  <span className="text-xs text-teal-300 flex items-center gap-1 font-mono animate-pulse">
                    <Volume2 className="w-3.5 h-3.5" /> Speaking
                  </span>
                )}
              </div>
              <p className="text-base font-medium text-teal-100 leading-relaxed font-sans">
                "{agentResponseHindi}"
              </p>
              <p className="text-xs text-teal-300/80 mt-1 italic">
                Translation: "{agentResponseEng}"
              </p>
            </div>

            {/* Patient Speech Transcript */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 min-h-[90px]">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Patient Colloquial Utterance:
              </span>
              <p className="text-sm text-slate-200 font-sans">
                {transcript ? `"${transcript}"` : <span className="text-slate-500 italic">No verbal complaint recorded yet. Tap microphone or select a preset scenario below.</span>}
              </p>
            </div>

            {/* Extracted Clinical Entity Badges & Red Flags */}
            <div className="mt-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Auto-Extracted Clinical Entities:
              </span>
              <div className="flex flex-wrap gap-2">
                {extractedChips.length === 0 && (
                  <span className="text-xs text-slate-500">Awaiting symptom extraction...</span>
                )}
                {extractedChips.map((chip, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-teal-300 border border-teal-500/30 shadow-sm"
                  >
                    <CheckCircle2 className="w-3 h-3 text-teal-400" />
                    {chip}
                  </span>
                ))}
              </div>

              {/* Red-Flag Alert Badge if detected */}
              {redFlagsDetected.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-2.5 text-rose-300">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-rose-200 uppercase tracking-wider block">
                      Clinical Red Flags Detected:
                    </span>
                    <span>{redFlagsDetected.join(", ")}. Immediate vitals & mucosal camera capture advised.</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Row: Advance to Reticle Capture */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {dialogueState === "S2" ? "Ready for camera biomarker scan" : "Step 1 of 3: Vernacular Intake"}
            </span>
            <button
              id="proceed-to-vision-btn"
              onClick={advanceToVision}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-teal-900/30 transition-all cursor-pointer"
            >
              Open Camera Reticle <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Preset Vernacular Patient Dialogue Scenarios */}
      <div className="mt-6 pt-5 border-t border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              One-Tap Vernacular Patient Scenarios (ANM Simulation Mode):
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">Tap to test voice NLP & red-flag detection</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {PRESET_PATIENT_SCENARIOS.map((sc, idx) => (
            <button
              key={idx}
              id={`preset-scenario-${idx}`}
              onClick={() => loadScenario(sc)}
              className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.01] ${
                sc.redFlag
                  ? "bg-rose-950/20 border-rose-800/40 hover:border-rose-500/60"
                  : "bg-slate-800/40 border-slate-700/60 hover:border-teal-500/50"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-200 truncate">{sc.label.split(":")[0]}</span>
                {sc.redFlag && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">RED</span>
                )}
              </div>
              <p className="text-xs text-slate-300 italic line-clamp-2 mb-2 font-sans">
                "{sc.hindiText}"
              </p>
              <div className="flex flex-wrap gap-1">
                {sc.tags.map((t, tidx) => (
                  <span key={tidx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {t}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

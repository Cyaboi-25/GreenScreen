import { useState, useRef, useCallback } from "react";

const SYSTEM_PROMPT = `You are an expert lawn care diagnostician and agronomist. You analyze photos of lawns to identify issues and provide detailed restoration plans.

When analyzing a lawn photo, you MUST respond in this exact JSON format and nothing else — no markdown, no backticks, no preamble:

{
  "overallHealth": "number 1-10",
  "grassType": "best guess of grass type based on visual",
  "issues": [
    {
      "name": "Issue name",
      "severity": "mild|moderate|severe",
      "description": "What you see and why it's a problem",
      "affectedArea": "percentage estimate of lawn affected"
    }
  ],
  "restorationPlan": [
    {
      "phase": 1,
      "title": "Phase title",
      "timeframe": "e.g. Week 1-2",
      "tasks": [
        {
          "task": "Specific action to take",
          "details": "How to do it, products to use, etc.",
          "priority": "critical|important|recommended"
        }
      ]
    }
  ],
  "quickWins": ["Immediate simple things they can do today"],
  "seasonalNote": "Any seasonal timing advice based on what you see"
}

Be specific with product recommendations, measurements, and timing. If you can identify the climate zone from visual cues, factor that into your advice. If the image is not a lawn or is unclear, say so in a simplified response.`;

const severityColor = {
  mild: { bg: "#E8F5E9", text: "#2E7D32", dot: "#4CAF50" },
  moderate: { bg: "#FFF3E0", text: "#E65100", dot: "#FF9800" },
  severe: { bg: "#FFEBEE", text: "#C62828", dot: "#F44336" },
};
const priorityColor = {
  critical: "#F44336",
  important: "#FF9800",
  recommended: "#4CAF50",
};

function HealthRing({ score, size = 120 }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;
  const color =
    score >= 7 ? "#4CAF50" : score >= 4 ? "#FF9800" : "#F44336";

  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="8"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={`${progress} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 1.2s ease" }}
      />
      <text
        x={size / 2}
        y={size / 2 - 6}
        textAnchor="middle"
        fill="white"
        fontSize="28"
        fontWeight="800"
        fontFamily="'DM Sans', sans-serif"
      >
        {score}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 14}
        textAnchor="middle"
        fill="rgba(255,255,255,0.5)"
        fontSize="11"
        fontFamily="'DM Sans', sans-serif"
        letterSpacing="2"
      >
        / 10
      </text>
    </svg>
  );
}

function PhaseCard({ phase, index }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        transition: "all 0.3s ease",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "18px 20px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "white",
          textAlign: "left",
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
            flexShrink: 0,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {phase.phase}
        </span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {phase.title}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.45)",
              marginTop: 2,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {phase.timeframe}
          </div>
        </div>
        <span
          style={{
            fontSize: 18,
            color: "rgba(255,255,255,0.3)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease",
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 20px 18px" }}>
          {phase.tasks.map((t, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 12,
                padding: "12px 0",
                borderTop:
                  i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: priorityColor[t.priority] || "#888",
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "white",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {t.task}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.5)",
                    marginTop: 4,
                    lineHeight: 1.5,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {t.details}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LawnScan() {
  const [screen, setScreen] = useState("home");
  const [image, setImage] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [error, setError] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState("");
  const fileRef = useRef();

  const scanMessages = [
    "Reading the grass blades...",
    "Checking soil indicators...",
    "Identifying weed species...",
    "Analyzing color distribution...",
    "Mapping bare patches...",
    "Evaluating root health signals...",
    "Assessing moisture levels...",
    "Building your restoration plan...",
  ];

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setImage(url);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      setImageData({ base64, mediaType: file.type });
    };
    reader.readAsDataURL(file);
  }, []);

  const runScan = useCallback(async () => {
    if (!imageData) return;
    setScreen("scanning");
    setError(null);
    setScanProgress(0);

    let msgIdx = 0;
    setScanMessage(scanMessages[0]);
    const progressInterval = setInterval(() => {
      setScanProgress((p) => Math.min(p + Math.random() * 8 + 2, 92));
      msgIdx = (msgIdx + 1) % scanMessages.length;
      setScanMessage(scanMessages[msgIdx]);
    }, 1800);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: imageData.mediaType,
                    data: imageData.base64,
                  },
                },
                {
                  type: "text",
                  text: "Analyze this lawn photo. Identify all visible issues (weeds, bare spots, disease, pests, thatch, compaction, discoloration, etc.) and provide a detailed phased restoration plan with specific timeframes, products, and measurements. Respond ONLY with valid JSON, no markdown or backticks.",
                },
              ],
            },
          ],
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message || "API error");

      const text = data.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      clearInterval(progressInterval);
      setScanProgress(100);
      setScanMessage("Diagnosis complete!");

      setTimeout(() => {
        setDiagnosis(parsed);
        setScreen("results");
      }, 600);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err.message || "Something went wrong. Try again.");
      setScreen("home");
    }
  }, [imageData]);

  const reset = () => {
    setScreen("home");
    setImage(null);
    setImageData(null);
    setDiagnosis(null);
    setError(null);
  };

  const pageStyle = {
    minHeight: "100vh",
    background: "#0A0F0A",
    color: "white",
    fontFamily: "'DM Sans', sans-serif",
    position: "relative",
    overflow: "hidden",
  };

  const bgGlow = {
    position: "fixed",
    top: "-40%",
    left: "-20%",
    width: "140%",
    height: "140%",
    background:
      "radial-gradient(ellipse at 30% 20%, rgba(46,125,50,0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(27,94,32,0.08) 0%, transparent 50%)",
    pointerEvents: "none",
    zIndex: 0,
  };

  if (screen === "home") {
    return (
      <div style={pageStyle}>
        <div style={bgGlow} />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 480,
            margin: "0 auto",
            padding: "60px 24px 40px",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <circle cx="18" cy="18" r="18" fill="#2E7D32" />
                <path
                  d="M18 8c-2 4-6 7-6 12a6 6 0 0012 0c0-5-4-8-6-12z"
                  fill="#81C784"
                  opacity="0.8"
                />
                <path
                  d="M18 12c-1.5 3-4 5.5-4 9a4 4 0 008 0c0-3.5-2.5-6-4-9z"
                  fill="#C8E6C9"
                  opacity="0.6"
                />
              </svg>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: "-0.5px",
                }}
              >
                LawnScan
              </span>
            </div>
            <p
              style={{
                fontSize: 15,
                color: "rgba(255,255,255,0.45)",
                lineHeight: 1.6,
                maxWidth: 320,
                margin: "0 auto",
              }}
            >
              Snap a photo of your lawn. Get an AI diagnosis and a
              step-by-step restoration plan.
            </p>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer?.files?.[0];
              if (file) handleFile(file);
            }}
            style={{
              border: "2px dashed rgba(76,175,80,0.3)",
              borderRadius: 20,
              padding: image ? 0 : "56px 24px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.3s ease",
              background: image ? "none" : "rgba(76,175,80,0.03)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {image ? (
              <img
                src={image}
                alt="Lawn preview"
                style={{
                  width: "100%",
                  maxHeight: 320,
                  objectFit: "cover",
                  display: "block",
                  borderRadius: 18,
                }}
              />
            ) : (
              <>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "rgba(76,175,80,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                    fontSize: 28,
                  }}
                >
                  📸
                </div>
                <div
                  style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}
                >
                  Upload a lawn photo
                </div>
                <div
                  style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}
                >
                  Tap to take a photo or choose from gallery
                </div>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          {image && (
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button
                onClick={reset}
                style={{
                  flex: 1,
                  padding: "16px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "white",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Clear
              </button>
              <button
                onClick={runScan}
                style={{
                  flex: 2,
                  padding: "16px",
                  borderRadius: 14,
                  border: "none",
                  background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
                  color: "white",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: "0 4px 20px rgba(76,175,80,0.3)",
                }}
              >
                🔍 Scan My Lawn
              </button>
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: 20,
                padding: "14px 18px",
                borderRadius: 12,
                background: "rgba(244,67,54,0.1)",
                border: "1px solid rgba(244,67,54,0.2)",
                color: "#EF9A9A",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <div style={{ marginTop: 48 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(255,255,255,0.3)",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              How it works
            </div>
            {[
              { icon: "📷", label: "Snap", desc: "Take a photo of your lawn" },
              {
                icon: "🧠",
                label: "Scan",
                desc: "AI identifies weeds, disease & damage",
              },
              {
                icon: "📋",
                label: "Plan",
                desc: "Get a phased restoration roadmap",
              },
            ].map((step, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 0",
                  borderBottom:
                    i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}
              >
                <span style={{ fontSize: 24, width: 40, textAlign: "center" }}>
                  {step.icon}
                </span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>
                    {step.label}
                  </div>
                  <div
                    style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}
                  >
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (screen === "scanning") {
    return (
      <div style={pageStyle}>
        <div style={bgGlow} />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 480,
            margin: "0 auto",
            padding: "100px 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 140,
              height: 140,
              margin: "0 auto 40px",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "3px solid rgba(76,175,80,0.2)",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 10,
                borderRadius: "50%",
                border: "3px solid rgba(76,175,80,0.4)",
                animation: "pulse 2s ease-in-out infinite 0.3s",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 20,
                borderRadius: "50%",
                background: "rgba(76,175,80,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
              }}
            >
              🌿
            </div>
          </div>

          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
            Analyzing Your Lawn
          </div>
          <div
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.5)",
              marginBottom: 36,
              minHeight: 20,
            }}
          >
            {scanMessage}
          </div>

          <div
            style={{
              width: "100%",
              maxWidth: 280,
              height: 6,
              borderRadius: 3,
              background: "rgba(255,255,255,0.08)",
              margin: "0 auto",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${scanProgress}%`,
                borderRadius: 3,
                background: "linear-gradient(90deg, #4CAF50, #81C784)",
                transition: "width 0.8s ease",
              }}
            />
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.3)",
              marginTop: 12,
            }}
          >
            {Math.round(scanProgress)}%
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.08); opacity: 0.6; }
          }
        `}</style>
      </div>
    );
  }

  if (screen === "results" && diagnosis) {
    const d = diagnosis;
    const healthNum =
      typeof d.overallHealth === "string"
        ? parseInt(d.overallHealth, 10)
        : d.overallHealth;
    const healthLabel =
      healthNum >= 8
        ? "Excellent"
        : healthNum >= 6
        ? "Good"
        : healthNum >= 4
        ? "Fair"
        : "Needs Work";

    return (
      <div style={pageStyle}>
        <div style={bgGlow} />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 480,
            margin: "0 auto",
            padding: "24px 20px 60px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 28,
            }}
          >
            <button
              onClick={reset}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                padding: "8px 16px",
                color: "white",
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              ← New Scan
            </button>
            <span
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.3)",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>

          <div
            style={{
              position: "relative",
              borderRadius: 20,
              overflow: "hidden",
              marginBottom: 24,
            }}
          >
            <img
              src={image}
              alt="Scanned lawn"
              style={{
                width: "100%",
                maxHeight: 220,
                objectFit: "cover",
                display: "block",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
                padding: "40px 20px 16px",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {healthLabel}
                </div>
                {d.grassType && (
                  <div
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.5)",
                      marginTop: 2,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {d.grassType}
                  </div>
                )}
              </div>
              <HealthRing score={healthNum} size={80} />
            </div>
          </div>

          {d.issues && d.issues.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.3)",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                Issues Found — {d.issues.length}
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {d.issues.map((issue, i) => {
                  const sev =
                    severityColor[issue.severity] || severityColor.mild;
                  return (
                    <div
                      key={i}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: 14,
                        padding: "16px 18px",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {issue.name}
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: 1,
                            padding: "3px 10px",
                            borderRadius: 20,
                            background: sev.bg,
                            color: sev.text,
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {issue.severity}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "rgba(255,255,255,0.5)",
                          lineHeight: 1.55,
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        {issue.description}
                      </div>
                      {issue.affectedArea && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,0.3)",
                            marginTop: 8,
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          ~{issue.affectedArea} affected
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {d.quickWins && d.quickWins.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.3)",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                Quick Wins — Do Today
              </div>
              <div
                style={{
                  background:
                    "linear-gradient(135deg, rgba(76,175,80,0.08), rgba(46,125,50,0.04))",
                  borderRadius: 16,
                  padding: "16px 18px",
                  border: "1px solid rgba(76,175,80,0.15)",
                }}
              >
                {d.quickWins.map((w, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      padding: "8px 0",
                      borderBottom:
                        i < d.quickWins.length - 1
                          ? "1px solid rgba(255,255,255,0.05)"
                          : "none",
                    }}
                  >
                    <span
                      style={{
                        color: "#81C784",
                        fontSize: 14,
                        marginTop: 1,
                      }}
                    >
                      ✓
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        color: "rgba(255,255,255,0.7)",
                        lineHeight: 1.5,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {w}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {d.restorationPlan && d.restorationPlan.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.3)",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                Restoration Plan
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {[
                  { color: "#F44336", label: "Critical" },
                  { color: "#FF9800", label: "Important" },
                  { color: "#4CAF50", label: "Recommended" },
                ].map((l) => (
                  <div
                    key={l.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      color: "rgba(255,255,255,0.35)",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: l.color,
                      }}
                    />
                    {l.label}
                  </div>
                ))}
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {d.restorationPlan.map((phase, i) => (
                  <PhaseCard key={i} phase={phase} index={i} />
                ))}
              </div>
            </div>
          )}

          {d.seasonalNote && (
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                borderRadius: 14,
                padding: "16px 18px",
                border: "1px solid rgba(255,255,255,0.06)",
                marginBottom: 28,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.3)",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                🗓 Seasonal Note
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "rgba(255,255,255,0.6)",
                  lineHeight: 1.6,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {d.seasonalNote}
              </div>
            </div>
          )}

          <button
            onClick={reset}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
              color: "white",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: "0 4px 20px rgba(76,175,80,0.3)",
            }}
          >
            📸 Scan Another Area
          </button>
        </div>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        `}</style>
      </div>
    );
  }

  return null;
}

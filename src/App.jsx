import { useState, useRef, useCallback, useEffect } from "react";

const HISTORY_KEY = "lawnscan_history_v1";
const ZIP_KEY = "lawnscan_zip_v1";
const HISTORY_CAP = 20;
const MAX_IMG_DIM = 1280;

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

function downscaleImage(file, maxDim = MAX_IMG_DIM) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const base64 = dataUrl.split(",")[1];
        resolve({ dataUrl, base64, mediaType: "image/jpeg" });
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function HealthRing({ score, size = 120 }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;
  const color = score >= 7 ? "#4CAF50" : score >= 4 ? "#FF9800" : "#F44336";

  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={`${progress} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 1.2s ease" }} />
      <text x={size / 2} y={size / 2 - 6} textAnchor="middle"
        fill="white" fontSize="28" fontWeight="800"
        fontFamily="'DM Sans', sans-serif">{score}</text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle"
        fill="rgba(255,255,255,0.5)" fontSize="11"
        fontFamily="'DM Sans', sans-serif" letterSpacing="2">/ 10</text>
    </svg>
  );
}

function PhaseCard({ phase, index }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden",
    }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14,
        padding: "18px 20px", background: "none", border: "none",
        cursor: "pointer", color: "white", textAlign: "left",
      }}>
        <span style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700, flexShrink: 0,
          fontFamily: "'DM Sans', sans-serif",
        }}>{phase.phase}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>{phase.title}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 2, fontFamily: "'DM Sans', sans-serif" }}>{phase.timeframe}</div>
        </div>
        <span style={{
          fontSize: 18, color: "rgba(255,255,255,0.3)",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.3s ease",
        }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: "0 20px 18px" }}>
          {phase.tasks.map((t, i) => (
            <div key={i} style={{
              display: "flex", gap: 12, padding: "12px 0",
              borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: priorityColor[t.priority] || "#888",
                marginTop: 6, flexShrink: 0,
              }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "white", fontFamily: "'DM Sans', sans-serif" }}>{t.task}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{t.details}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImageWithMarkers({ src, markers, alt }) {
  const [showLabels, setShowLabels] = useState(false);
  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#000" }}
      onClick={() => setShowLabels((s) => !s)}>
      <img src={src} alt={alt} style={{ width: "100%", display: "block", maxHeight: 360, objectFit: "cover" }} />
      {markers.map((m, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${(m.x ?? 0.5) * 100}%`,
          top: `${(m.y ?? 0.5) * 100}%`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: severityColor[m.severity]?.dot || "#FF9800",
            color: "white", fontSize: 13, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid white",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            fontFamily: "'DM Sans', sans-serif",
          }}>{m.issueIndex + 1}</div>
          {showLabels && m.label && (
            <div style={{
              position: "absolute", top: 32, left: "50%", transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.85)", color: "white",
              fontSize: 11, padding: "4px 8px", borderRadius: 6,
              whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif",
            }}>{m.label}</div>
          )}
        </div>
      ))}
      {markers.length > 0 && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          background: "rgba(0,0,0,0.6)", color: "white",
          fontSize: 11, padding: "4px 8px", borderRadius: 12,
          fontFamily: "'DM Sans', sans-serif",
        }}>tap to {showLabels ? "hide" : "show"} labels</div>
      )}
    </div>
  );
}

export default function LawnScan() {
  const [screen, setScreen] = useState("home");
  const [images, setImages] = useState([]);
  const [zipcode, setZipcode] = useState("");
  const [diagnosis, setDiagnosis] = useState(null);
  const [resultImages, setResultImages] = useState([]);
  const [resultZip, setResultZip] = useState("");
  const [resultDate, setResultDate] = useState(null);
  const [error, setError] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState("");
  const [history, setHistory] = useState([]);
  const fileRef = useRef();

  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      setHistory(h);
    } catch {}
    const z = localStorage.getItem(ZIP_KEY);
    if (z) setZipcode(z);
  }, []);

  useEffect(() => {
    if (zipcode) localStorage.setItem(ZIP_KEY, zipcode);
  }, [zipcode]);

  const scanMessages = [
    "Reading the grass blades...",
    "Checking soil indicators...",
    "Identifying weed species...",
    "Mapping bare patches...",
    "Researching your climate zone...",
    "Looking up regional products...",
    "Cross-referencing local conditions...",
    "Building your restoration plan...",
  ];

  const handleFiles = useCallback(async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    const processed = await Promise.all(
      files.map(async (f) => ({
        id: crypto.randomUUID(),
        ...(await downscaleImage(f)),
      }))
    );
    setImages((prev) => [...prev, ...processed]);
  }, []);

  const removeImage = (id) =>
    setImages((prev) => prev.filter((img) => img.id !== id));

  const saveToHistory = useCallback((entry) => {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, HISTORY_CAP);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch (e) {
        const trimmed = next.slice(0, Math.max(1, Math.floor(next.length / 2)));
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed)); } catch {}
        return trimmed;
      }
      return next;
    });
  }, []);

  const deleteFromHistory = (id) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const openSavedScan = (entry) => {
    setDiagnosis(entry.diagnosis);
    setResultImages(entry.images);
    setResultZip(entry.zipcode);
    setResultDate(entry.timestamp);
    setScreen("results");
  };

  const runScan = useCallback(async () => {
    if (images.length === 0) return;
    setScreen("scanning");
    setError(null);
    setScanProgress(0);

    let msgIdx = 0;
    setScanMessage(scanMessages[0]);
    const progressInterval = setInterval(() => {
      setScanProgress((p) => Math.min(p + Math.random() * 6 + 1, 92));
      msgIdx = (msgIdx + 1) % scanMessages.length;
      setScanMessage(scanMessages[msgIdx]);
    }, 1800);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map((i) => ({ base64: i.base64, mediaType: i.mediaType })),
          zipcode: zipcode.trim(),
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message || "API error");

      clearInterval(progressInterval);
      setScanProgress(100);
      setScanMessage("Diagnosis complete!");

      const entry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        zipcode: zipcode.trim(),
        images: images.map((i) => ({ id: i.id, dataUrl: i.dataUrl })),
        diagnosis: data,
      };
      saveToHistory(entry);

      setTimeout(() => {
        setDiagnosis(data);
        setResultImages(entry.images);
        setResultZip(entry.zipcode);
        setResultDate(entry.timestamp);
        setScreen("results");
      }, 600);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err.message || "Something went wrong. Try again.");
      setScreen("home");
    }
  }, [images, zipcode, saveToHistory]);

  const reset = () => {
    setScreen("home");
    setImages([]);
    setDiagnosis(null);
    setResultImages([]);
    setResultDate(null);
    setError(null);
  };

  const pageStyle = {
    minHeight: "100vh", background: "#0A0F0A", color: "white",
    fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden",
  };
  const bgGlow = {
    position: "fixed", top: "-40%", left: "-20%", width: "140%", height: "140%",
    background: "radial-gradient(ellipse at 30% 20%, rgba(46,125,50,0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(27,94,32,0.08) 0%, transparent 50%)",
    pointerEvents: "none", zIndex: 0,
  };

  if (screen === "home") {
    return (
      <div style={pageStyle}>
        <div style={bgGlow} />
        <div style={{
          position: "relative", zIndex: 1, maxWidth: 480,
          margin: "0 auto", padding: "60px 24px 40px",
        }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <circle cx="18" cy="18" r="18" fill="#2E7D32" />
                <path d="M18 8c-2 4-6 7-6 12a6 6 0 0012 0c0-5-4-8-6-12z" fill="#81C784" opacity="0.8" />
                <path d="M18 12c-1.5 3-4 5.5-4 9a4 4 0 008 0c0-3.5-2.5-6-4-9z" fill="#C8E6C9" opacity="0.6" />
              </svg>
              <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" }}>LawnScan</span>
            </div>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, maxWidth: 320, margin: "0 auto" }}>
              Snap photos of your lawn. Get an AI diagnosis with a step-by-step restoration plan tailored to your area.
            </p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block", fontSize: 12, fontWeight: 600,
              color: "rgba(255,255,255,0.5)", marginBottom: 8,
              letterSpacing: 1, textTransform: "uppercase",
            }}>ZIP code (for regional research)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={zipcode}
              onChange={(e) => setZipcode(e.target.value)}
              placeholder="e.g. 30301"
              style={{
                width: "100%", padding: "14px 16px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12, color: "white", fontSize: 15,
                fontFamily: "'DM Sans', sans-serif", outline: "none",
              }}
            />
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation();
              handleFiles(e.dataTransfer?.files);
            }}
            style={{
              border: "2px dashed rgba(76,175,80,0.3)", borderRadius: 20,
              padding: "40px 24px", textAlign: "center", cursor: "pointer",
              background: "rgba(76,175,80,0.03)",
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(76,175,80,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px", fontSize: 24,
            }}>📸</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              {images.length > 0 ? "Add more photos" : "Upload lawn photos"}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
              You can upload multiple — they'll be analyzed as one property
            </div>
            <input
              ref={fileRef} type="file" accept="image/*" multiple
              style={{ display: "none" }}
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
            />
          </div>

          {images.length > 0 && (
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8, marginTop: 16,
            }}>
              {images.map((img) => (
                <div key={img.id} style={{
                  position: "relative", paddingBottom: "100%",
                  borderRadius: 10, overflow: "hidden", background: "#000",
                }}>
                  <img src={img.dataUrl} alt="" style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%",
                    objectFit: "cover",
                  }} />
                  <button onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                    style={{
                      position: "absolute", top: 4, right: 4,
                      width: 22, height: 22, borderRadius: "50%",
                      background: "rgba(0,0,0,0.7)", color: "white",
                      border: "none", cursor: "pointer", fontSize: 14,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      lineHeight: 1,
                    }}>×</button>
                </div>
              ))}
            </div>
          )}

          {images.length > 0 && (
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button onClick={() => setImages([])} style={{
                flex: 1, padding: "16px", borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)", color: "white",
                fontSize: 15, fontWeight: 600, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}>Clear</button>
              <button onClick={runScan} style={{
                flex: 2, padding: "16px", borderRadius: 14, border: "none",
                background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
                color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: "0 4px 20px rgba(76,175,80,0.3)",
              }}>🔍 Scan ({images.length})</button>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: 20, padding: "14px 18px", borderRadius: 12,
              background: "rgba(244,67,54,0.1)",
              border: "1px solid rgba(244,67,54,0.2)",
              color: "#EF9A9A", fontSize: 14, lineHeight: 1.5,
            }}>⚠️ {error}</div>
          )}

          {history.length > 0 && (
            <div style={{ marginTop: 40 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.3)",
                letterSpacing: 2, textTransform: "uppercase", marginBottom: 14,
              }}>Saved Scans</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {history.map((h) => {
                  const score = parseInt(h.diagnosis.overallHealth, 10) || 0;
                  const color = score >= 7 ? "#4CAF50" : score >= 4 ? "#FF9800" : "#F44336";
                  return (
                    <div key={h.id} style={{
                      display: "flex", gap: 12, alignItems: "center",
                      background: "rgba(255,255,255,0.04)", borderRadius: 12,
                      padding: 10, border: "1px solid rgba(255,255,255,0.06)",
                    }}>
                      <div onClick={() => openSavedScan(h)} style={{
                        flex: 1, display: "flex", gap: 12, alignItems: "center",
                        cursor: "pointer",
                      }}>
                        {h.images[0]?.dataUrl && (
                          <img src={h.images[0].dataUrl} alt="" style={{
                            width: 56, height: 56, borderRadius: 8, objectFit: "cover",
                          }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>
                            {h.diagnosis.grassType || "Lawn scan"}
                          </div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                            {new Date(h.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {h.zipcode ? ` · ${h.zipcode}` : ""}
                            {h.images.length > 1 ? ` · ${h.images.length} photos` : ""}
                          </div>
                        </div>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: color, color: "white",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, fontWeight: 800,
                        }}>{score}</div>
                      </div>
                      <button onClick={() => deleteFromHistory(h.id)} style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 14,
                      }}>×</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (screen === "scanning") {
    return (
      <div style={pageStyle}>
        <div style={bgGlow} />
        <div style={{
          position: "relative", zIndex: 1, maxWidth: 480,
          margin: "0 auto", padding: "100px 24px", textAlign: "center",
        }}>
          <div style={{ width: 140, height: 140, margin: "0 auto 40px", position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid rgba(76,175,80,0.2)", animation: "pulse 2s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: 10, borderRadius: "50%", border: "3px solid rgba(76,175,80,0.4)", animation: "pulse 2s ease-in-out infinite 0.3s" }} />
            <div style={{ position: "absolute", inset: 20, borderRadius: "50%", background: "rgba(76,175,80,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>🌿</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Analyzing Your Lawn</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 36, minHeight: 20 }}>{scanMessage}</div>
          <div style={{ width: "100%", maxWidth: 280, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", margin: "0 auto", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${scanProgress}%`, borderRadius: 3, background: "linear-gradient(90deg, #4CAF50, #81C784)", transition: "width 0.8s ease" }} />
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginTop: 12 }}>{Math.round(scanProgress)}%</div>
        </div>
        <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.6; } }`}</style>
      </div>
    );
  }

  if (screen === "results" && diagnosis) {
    const d = diagnosis;
    const healthNum = typeof d.overallHealth === "string" ? parseInt(d.overallHealth, 10) : d.overallHealth;
    const healthLabel = healthNum >= 8 ? "Excellent" : healthNum >= 6 ? "Good" : healthNum >= 4 ? "Fair" : "Needs Work";

    const markersByImage = {};
    (d.issues || []).forEach((issue, issueIndex) => {
      (issue.imageMarkers || []).forEach((m) => {
        const idx = m.imageIndex ?? 0;
        if (!markersByImage[idx]) markersByImage[idx] = [];
        markersByImage[idx].push({ ...m, issueIndex, severity: issue.severity });
      });
    });

    return (
      <div style={pageStyle}>
        <div style={bgGlow} />
        <div style={{
          position: "relative", zIndex: 1, maxWidth: 480,
          margin: "0 auto", padding: "24px 20px 60px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button onClick={reset} style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, padding: "8px 16px", color: "white",
              fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>← Home</button>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
              {new Date(resultDate || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {resultZip ? ` · ${resultZip}` : ""}
            </span>
          </div>

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(255,255,255,0.04)", borderRadius: 16,
            padding: 18, marginBottom: 20,
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{healthLabel}</div>
              {d.grassType && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{d.grassType}</div>}
            </div>
            <HealthRing score={healthNum} size={86} />
          </div>

          {resultImages.length > 0 && (
            <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 10 }}>
              {resultImages.map((img, i) => (
                <ImageWithMarkers
                  key={img.id || i}
                  src={img.dataUrl}
                  alt={`Lawn ${i + 1}`}
                  markers={markersByImage[i] || []}
                />
              ))}
            </div>
          )}

          {d.issues && d.issues.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.3)",
                letterSpacing: 2, textTransform: "uppercase", marginBottom: 14,
              }}>Issues Found — {d.issues.length}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {d.issues.map((issue, i) => {
                  const sev = severityColor[issue.severity] || severityColor.mild;
                  return (
                    <div key={i} style={{
                      background: "rgba(255,255,255,0.04)", borderRadius: 14,
                      padding: "16px 18px", border: "1px solid rgba(255,255,255,0.06)",
                    }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center", marginBottom: 8, gap: 8,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: "50%",
                            background: sev.dot, color: "white", fontSize: 12,
                            fontWeight: 800, display: "flex",
                            alignItems: "center", justifyContent: "center",
                          }}>{i + 1}</span>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{issue.name}</div>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                          letterSpacing: 1, padding: "3px 10px", borderRadius: 20,
                          background: sev.bg, color: sev.text,
                        }}>{issue.severity}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.55 }}>{issue.description}</div>
                      {issue.affectedArea && (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>~{issue.affectedArea} affected</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {d.regionalResearch && (
            <div style={{ marginBottom: 28 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.3)",
                letterSpacing: 2, textTransform: "uppercase", marginBottom: 14,
              }}>📍 Regional Research</div>
              <div style={{
                background: "linear-gradient(135deg, rgba(33,150,243,0.06), rgba(33,150,243,0.02))",
                borderRadius: 16, padding: "16px 18px",
                border: "1px solid rgba(33,150,243,0.15)",
              }}>
                {d.regionalResearch.climateZone && (
                  <div style={{ fontSize: 13, color: "#90CAF9", marginBottom: 10, fontWeight: 600 }}>
                    {d.regionalResearch.climateZone}
                  </div>
                )}
                {d.regionalResearch.regionalAdvice && (
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: 12 }}>
                    {d.regionalResearch.regionalAdvice}
                  </div>
                )}
                {d.regionalResearch.localConcerns && (
                  <div style={{
                    fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.55,
                    padding: "10px 12px", background: "rgba(255,193,7,0.06)",
                    borderRadius: 8, borderLeft: "3px solid rgba(255,193,7,0.4)",
                    marginBottom: 12,
                  }}>⚠️ {d.regionalResearch.localConcerns}</div>
                )}
                {d.regionalResearch.productRecommendations?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)",
                      letterSpacing: 1, textTransform: "uppercase", marginBottom: 8,
                    }}>Recommended Products</div>
                    {d.regionalResearch.productRecommendations.map((p, i) => (
                      <div key={i} style={{
                        padding: "8px 0",
                        borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{p.use}</div>
                        {p.where && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{p.where}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {d.regionalResearch.sources?.length > 0 && (
                  <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                    Sources: {d.regionalResearch.sources.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noopener noreferrer"
                        style={{ color: "#90CAF9", marginRight: 8, textDecoration: "none" }}>[{i + 1}]</a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {d.quickWins && d.quickWins.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.3)",
                letterSpacing: 2, textTransform: "uppercase", marginBottom: 14,
              }}>Quick Wins — Do Today</div>
              <div style={{
                background: "linear-gradient(135deg, rgba(76,175,80,0.08), rgba(46,125,50,0.04))",
                borderRadius: 16, padding: "16px 18px",
                border: "1px solid rgba(76,175,80,0.15)",
              }}>
                {d.quickWins.map((w, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0",
                    borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  }}>
                    <span style={{ color: "#81C784", fontSize: 14, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{w}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {d.restorationPlan && d.restorationPlan.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.3)",
                letterSpacing: 2, textTransform: "uppercase", marginBottom: 14,
              }}>Restoration Plan</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {d.restorationPlan.map((phase, i) => (
                  <PhaseCard key={i} phase={phase} index={i} />
                ))}
              </div>
            </div>
          )}

          {d.seasonalNote && (
            <div style={{
              background: "rgba(255,255,255,0.03)", borderRadius: 14,
              padding: "16px 18px", border: "1px solid rgba(255,255,255,0.06)",
              marginBottom: 28,
            }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.3)",
                letterSpacing: 2, textTransform: "uppercase", marginBottom: 10,
              }}>🗓 Seasonal Note</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{d.seasonalNote}</div>
            </div>
          )}

          <button onClick={reset} style={{
            width: "100%", padding: "16px", borderRadius: 14, border: "none",
            background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
            color: "white", fontSize: 16, fontWeight: 700, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: "0 4px 20px rgba(76,175,80,0.3)",
          }}>📸 New Scan</button>
        </div>

        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>
      </div>
    );
  }

  return null;
}

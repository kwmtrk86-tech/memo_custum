import { useState, useEffect, useRef, useCallback } from "react";

const WORK_MINUTES = 25;
const BREAK_MINUTES = 5;
const WORK_SECONDS = WORK_MINUTES * 60;
const BREAK_SECONDS = BREAK_MINUTES * 60;

// Storage helpers
const STORAGE_KEY = "pomodoro-stats-v2";

function loadStats() {
  try {
    const raw = window._pomodoroStats;
    if (raw) return raw;
  } catch {}
  return { sessions: [] };
}

function saveStats(stats) {
  window._pomodoroStats = stats;
}

// Initialize from persistent storage
async function initStats() {
  try {
    const result = await window.storage.get(STORAGE_KEY);
    if (result && result.value) {
      const parsed = JSON.parse(result.value);
      window._pomodoroStats = parsed;
      return parsed;
    }
  } catch {}
  return { sessions: [] };
}

async function persistStats(stats) {
  saveStats(stats);
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(stats));
  } catch {}
}

// Date helpers
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toWeekStr(d) {
  const tmp = new Date(d);
  tmp.setDate(tmp.getDate() - tmp.getDay());
  return toDateStr(tmp);
}
function toMonthStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function toYearStr(d) {
  return `${d.getFullYear()}`;
}

function groupBy(sessions, keyFn, labelFn, count) {
  const map = {};
  const now = new Date();
  // Generate last `count` keys
  const keys = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    if (keyFn === toDateStr) d.setDate(d.getDate() - i);
    else if (keyFn === toWeekStr) d.setDate(d.getDate() - i * 7);
    else if (keyFn === toMonthStr) d.setMonth(d.getMonth() - i);
    else if (keyFn === toYearStr) d.setFullYear(d.getFullYear() - i);
    const k = keyFn(d);
    if (!keys.includes(k)) {
      keys.push(k);
      map[k] = { key: k, label: labelFn(d), count: 0 };
    }
  }
  sessions.forEach((s) => {
    const d = new Date(s);
    const k = keyFn(d);
    if (map[k]) map[k].count++;
  });
  return keys.map((k) => map[k]);
}

function dayLabel(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function weekLabel(d) {
  const tmp = new Date(d);
  tmp.setDate(tmp.getDate() - tmp.getDay());
  return `${tmp.getMonth() + 1}/${tmp.getDate()}~`;
}
function monthLabel(d) {
  return `${d.getFullYear()}/${d.getMonth() + 1}`;
}
function yearLabel(d) {
  return `${d.getFullYear()}`;
}

// Bar chart component
function BarChart({ data, accentColor, label }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          fontSize: "11px",
          color: "#8a8a8e",
          marginBottom: "10px",
          fontWeight: 600,
          letterSpacing: "0.5px",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "4px",
          height: "110px",
          padding: "0 2px",
        }}
      >
        {data.map((d, i) => {
          const h = Math.max((d.count / max) * 90, d.count > 0 ? 6 : 2);
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  color: d.count > 0 ? accentColor : "#555",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  opacity: d.count > 0 ? 1 : 0.4,
                }}
              >
                {d.count > 0 ? d.count : ""}
              </span>
              <div
                style={{
                  width: "100%",
                  maxWidth: "36px",
                  height: `${h}px`,
                  background:
                    d.count > 0
                      ? `linear-gradient(180deg, ${accentColor}, ${accentColor}88)`
                      : "#2a2a2e",
                  borderRadius: "4px 4px 2px 2px",
                  transition: "height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              />
              <span
                style={{
                  fontSize: "9px",
                  color: "#6e6e73",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "48px",
                  textAlign: "center",
                }}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Circular timer
function CircleTimer({ progress, timeStr, isWork, isRunning }) {
  const r = 108;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);
  const color = isWork ? "#ff453a" : "#30d158";
  const glowColor = isWork ? "rgba(255,69,58,0.35)" : "rgba(48,209,88,0.35)";

  return (
    <div style={{ position: "relative", width: 260, height: 260 }}>
      <svg width={260} height={260} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={130}
          cy={130}
          r={r}
          fill="none"
          stroke="#2a2a2e"
          strokeWidth={10}
        />
        <circle
          cx={130}
          cy={130}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 0.5s ease",
            filter: isRunning ? `drop-shadow(0 0 12px ${glowColor})` : "none",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: "52px",
            fontWeight: 200,
            color: "#f5f5f7",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-2px",
            fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
          }}
        >
          {timeStr}
        </span>
        <span
          style={{
            fontSize: "13px",
            color: color,
            fontWeight: 600,
            letterSpacing: "2px",
            textTransform: "uppercase",
            marginTop: "4px",
          }}
        >
          {isWork ? "集中" : "休憩"}
        </span>
      </div>
    </div>
  );
}

export default function PomodoroApp() {
  const [stats, setStats] = useState({ sessions: [] });
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState("work"); // work | break
  const [secondsLeft, setSecondsLeft] = useState(WORK_SECONDS);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState("timer"); // timer | stats
  const [statsPeriod, setStatsPeriod] = useState("day");
  const intervalRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Load persisted stats on mount
  useEffect(() => {
    initStats().then((s) => {
      setStats(s);
      setLoaded(true);
    });
  }, []);

  const playBeep = useCallback(() => {
    try {
      if (!audioCtxRef.current)
        audioCtxRef.current = new (
          window.AudioContext || window.webkitAudioContext
        )();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);

  const addSession = useCallback(async () => {
    const newStats = {
      ...stats,
      sessions: [...stats.sessions, new Date().toISOString()],
    };
    setStats(newStats);
    await persistStats(newStats);
  }, [stats]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          playBeep();
          if (mode === "work") {
            addSession();
            setMode("break");
            setRunning(false);
            return BREAK_SECONDS;
          } else {
            setMode("work");
            setRunning(false);
            return WORK_SECONDS;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, mode, playBeep, addSession]);

  const toggleRun = () => setRunning(!running);
  const reset = () => {
    setRunning(false);
    setSecondsLeft(mode === "work" ? WORK_SECONDS : BREAK_SECONDS);
  };
  const skip = () => {
    setRunning(false);
    if (mode === "work") {
      setMode("break");
      setSecondsLeft(BREAK_SECONDS);
    } else {
      setMode("work");
      setSecondsLeft(WORK_SECONDS);
    }
  };

  const clearStats = async () => {
    const empty = { sessions: [] };
    setStats(empty);
    await persistStats(empty);
  };

  const totalSeconds = mode === "work" ? WORK_SECONDS : BREAK_SECONDS;
  const progress = 1 - secondsLeft / totalSeconds;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const isWork = mode === "work";
  const accent = isWork ? "#ff453a" : "#30d158";

  // Stats data
  const chartConfigs = {
    day: {
      fn: toDateStr,
      label: dayLabel,
      count: 14,
      title: "日別（過去14日間）",
    },
    week: {
      fn: toWeekStr,
      label: weekLabel,
      count: 8,
      title: "週別（過去8週間）",
    },
    month: {
      fn: toMonthStr,
      label: monthLabel,
      count: 12,
      title: "月別（過去12ヶ月）",
    },
    year: {
      fn: toYearStr,
      label: yearLabel,
      count: 5,
      title: "年別（過去5年間）",
    },
  };

  const todayCount = stats.sessions.filter(
    (s) => toDateStr(new Date(s)) === toDateStr(new Date()),
  ).length;
  const totalCount = stats.sessions.length;

  if (!loaded)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#161618",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#8a8a8e",
          fontFamily:
            "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', -apple-system, sans-serif",
        }}
      >
        読み込み中...
      </div>
    );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#161618",
        color: "#f5f5f7",
        fontFamily:
          "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0",
        overflow: "auto",
      }}
    >
      {/* Header tabs */}
      <div
        style={{
          display: "flex",
          gap: "0",
          marginTop: "28px",
          marginBottom: "24px",
          background: "#1c1c1e",
          borderRadius: "12px",
          padding: "3px",
        }}
      >
        {[
          { id: "timer", label: "タイマー" },
          { id: "stats", label: "統計" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 28px",
              border: "none",
              borderRadius: "10px",
              background: tab === t.id ? "#2c2c2e" : "transparent",
              color: tab === t.id ? "#f5f5f7" : "#6e6e73",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              fontFamily: "inherit",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "timer" ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "28px",
            width: "100%",
            maxWidth: 400,
            padding: "0 20px",
          }}
        >
          {/* Today stats pill */}
          <div
            style={{
              display: "flex",
              gap: "20px",
              background: "#1c1c1e",
              borderRadius: "14px",
              padding: "12px 24px",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: 700,
                  color: "#ff9f0a",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {todayCount}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#8a8a8e",
                  fontWeight: 500,
                  marginTop: "2px",
                }}
              >
                今日
              </div>
            </div>
            <div
              style={{ width: "1px", background: "#333", alignSelf: "stretch" }}
            />
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: 700,
                  color: "#8a8a8e",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {totalCount}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#8a8a8e",
                  fontWeight: 500,
                  marginTop: "2px",
                }}
              >
                累計
              </div>
            </div>
          </div>

          {/* Timer circle */}
          <CircleTimer
            progress={progress}
            timeStr={`${mm}:${ss}`}
            isWork={isWork}
            isRunning={running}
          />

          {/* Controls */}
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <button
              onClick={reset}
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: "1.5px solid #3a3a3c",
                background: "transparent",
                color: "#8a8a8e",
                fontSize: "18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
              title="リセット"
            >
              ↺
            </button>
            <button
              onClick={toggleRun}
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                border: "none",
                background: accent,
                color: "#fff",
                fontSize: "18px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: running
                  ? `0 0 24px ${accent}66`
                  : `0 4px 16px ${accent}44`,
                transition: "all 0.25s",
                fontFamily: "inherit",
                letterSpacing: "1px",
              }}
            >
              {running ? "停止" : "開始"}
            </button>
            <button
              onClick={skip}
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: "1.5px solid #3a3a3c",
                background: "transparent",
                color: "#8a8a8e",
                fontSize: "18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
              title="スキップ"
            >
              ⏭
            </button>
          </div>
        </div>
      ) : (
        /* Stats view */
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            padding: "0 20px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            paddingBottom: "40px",
          }}
        >
          {/* Summary cards */}
          <div style={{ display: "flex", gap: "10px" }}>
            {[
              { label: "今日", value: todayCount, color: "#ff9f0a" },
              {
                label: "今週",
                value: stats.sessions.filter(
                  (s) => toWeekStr(new Date(s)) === toWeekStr(new Date()),
                ).length,
                color: "#64d2ff",
              },
              {
                label: "今月",
                value: stats.sessions.filter(
                  (s) => toMonthStr(new Date(s)) === toMonthStr(new Date()),
                ).length,
                color: "#bf5af2",
              },
              { label: "累計", value: totalCount, color: "#8a8a8e" },
            ].map((c, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  background: "#1c1c1e",
                  borderRadius: "14px",
                  padding: "14px 10px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "26px",
                    fontWeight: 700,
                    color: c.color,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {c.value}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#6e6e73",
                    fontWeight: 500,
                    marginTop: "4px",
                  }}
                >
                  {c.label}
                </div>
              </div>
            ))}
          </div>

          {/* Period selector */}
          <div
            style={{
              display: "flex",
              gap: "0",
              background: "#1c1c1e",
              borderRadius: "10px",
              padding: "3px",
            }}
          >
            {[
              { id: "day", label: "日" },
              { id: "week", label: "週" },
              { id: "month", label: "月" },
              { id: "year", label: "年" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setStatsPeriod(p.id)}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  border: "none",
                  borderRadius: "8px",
                  background: statsPeriod === p.id ? "#2c2c2e" : "transparent",
                  color: statsPeriod === p.id ? "#f5f5f7" : "#6e6e73",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  fontFamily: "inherit",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div
            style={{
              background: "#1c1c1e",
              borderRadius: "16px",
              padding: "20px 16px",
            }}
          >
            <BarChart
              data={groupBy(
                stats.sessions,
                chartConfigs[statsPeriod].fn,
                chartConfigs[statsPeriod].label,
                chartConfigs[statsPeriod].count,
              )}
              accentColor={
                statsPeriod === "day"
                  ? "#ff9f0a"
                  : statsPeriod === "week"
                    ? "#64d2ff"
                    : statsPeriod === "month"
                      ? "#bf5af2"
                      : "#ff453a"
              }
              label={chartConfigs[statsPeriod].title}
            />
          </div>

          {/* Clear button */}
          <button
            onClick={() => {
              if (window.confirm("統計データをリセットしますか？"))
                clearStats();
            }}
            style={{
              padding: "12px",
              border: "1px solid #3a3a3c",
              borderRadius: "12px",
              background: "transparent",
              color: "#ff453a",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
          >
            統計データをリセット
          </button>
        </div>
      )}
    </div>
  );
}

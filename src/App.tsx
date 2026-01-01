"use client";

import { useState, useRef, useEffect } from "react";
import { motion, useScroll, useTransform, useInView, useAnimation } from "framer-motion";
import { 
  Sparkles, 
  Zap, 
  Shield, 
  Gauge, 
  Brain, 
  TrendingUp,
  ChevronRight,
  ChevronDown,
  Star,
  Users,
  ArrowRight,
  Check,
  Clock,
  Layers,
  Lock,
  Globe,
  Cpu,
  Database,
  Cloud,
  BarChart3,
  Workflow,
  Boxes,
  Network,
  GitBranch,
  Activity,
  BookOpen,
  Award,
  Target,
  MessageCircle,
  Mail,
  Phone,
  MapPin
} from "lucide-react";

// Load local logo so bundler resolves it reliably
import CIBO_ICON from '/CIBO_ICON.png';

// Animated Section Wrapper with Fade In/Out
function AnimatedSection({ children, className = "", delay = 0, initialY = 60, ...props }: any) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, amount: 0.2, margin: "-50px" });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: initialY }}
      animate={isInView ? { 
        opacity: 1, 
        y: 0 
      } : {
        opacity: 0,
        y: initialY * 0.7
      }}
      transition={{
        duration: 1.2,
        delay: isInView ? delay : 0,
        ease: [0.22, 1, 0.36, 1]
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// --- Booking Widget Helpers & Component ---------------------------------
function pad(n: number) { return n.toString().padStart(2, '0'); }

function getStockholmParts(date: Date) {
  const df = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short'
  });
  const parts = df.formatToParts(date).reduce((acc: any, p: any) => {
    acc[p.type] = p.value; return acc;
  }, {});
  return parts; // contains year, month, day, hour, minute, weekday
}

function makeDateKeyFromParts(parts: any) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function makeSlotKey(dateKey: string, hour: number, minute: number) {
  return `${dateKey}T${pad(hour)}:${pad(minute)}`;
}

function BookingWidget({ bookedSlots, setBookedSlots, onClose }: any) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  // date view unit (days / weeks / months / years)
  const [dateUnit, setDateUnit] = useState<'days'|'weeks'|'months'|'years'>('days');
  // UI flow: years -> months -> weeks -> days
  const [viewLevel, setViewLevel] = useState<'days'|'weeks'|'months'|'years'>('years');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [customDays, setCustomDays] = useState<any[] | null>(null);

  // week number helper (ISO week)
  function getISOWeek(d0: Date) {
    const d = new Date(Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  }

  // generate periods based on selected unit. periods are objects compatible with previous 'days' shape
  // `nowOverride` is used to allow controlled refresh (e.g. at midnight)
  function makePeriods(unit: typeof dateUnit, nowOverride?: Date) {
    const now = nowOverride || new Date();
    const periods: any[] = [];
    if (unit === 'days') {
      // compute 14-day block that contains `now` so the UI shows blocks of 14 days
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysSinceEpoch = Math.floor(now.getTime() / msPerDay);
      const blockIndex = Math.floor(daysSinceEpoch / 14);
      const blockStartEpoch = blockIndex * 14 * msPerDay;
      const blockStart = new Date(blockStartEpoch);
      for (let i = 0; i < 14; i++) {
        const inst = new Date(blockStart.getTime() + i * msPerDay);
        const parts = getStockholmParts(inst);
        const dateKey = makeDateKeyFromParts(parts);
        const display = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'short', day: '2-digit', month: 'short' }).format(inst);
        const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Stockholm', weekday: 'short' }).format(inst);
        periods.push({ inst, parts, dateKey, display, weekday });
      }
    } else if (unit === 'weeks') {
      // ISO week: start on Monday. compute current week's Monday
      const d = new Date(now);
      const jsDay = d.getDay();
      const isoDay = (jsDay + 6) % 7; // 0 = Monday
      const monday = new Date(d);
      monday.setDate(d.getDate() - isoDay);
      for (let i=0;i<8;i++){
        const inst = new Date(monday);
        inst.setDate(monday.getDate() + i*7);
        const parts = getStockholmParts(inst);
        const dateKey = makeDateKeyFromParts(parts);
        const weekNum = getISOWeek(inst);
        const display = `v${weekNum} ${new Intl.DateTimeFormat('sv-SE',{ timeZone: 'Europe/Stockholm', day: '2-digit', month: 'short' }).format(inst)}`;
        const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Stockholm', weekday: 'short' }).format(inst);
        periods.push({ inst, parts, dateKey, display, weekday });
      }
    } else if (unit === 'months') {
      // Use full 2026 year for months (Jan-Dec 2026)
      const y = 2026;
      for (let i = 0; i < 12; i++) {
        const inst = new Date(y, i, 1);
        const parts = getStockholmParts(inst);
        const dateKey = makeDateKeyFromParts(parts);
        const display = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', month: 'long', year: 'numeric' }).format(inst);
        const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Stockholm', weekday: 'short' }).format(inst);
        periods.push({ inst, parts, dateKey, display, weekday });
      }
    } else if (unit === 'years') {
      const y = now.getFullYear();
      for (let i=0;i<3;i++){
        const inst = new Date(y + i, 0, 1);
        const parts = getStockholmParts(inst);
        const dateKey = makeDateKeyFromParts(parts);
        const display = `${inst.getFullYear()}`;
        const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Stockholm', weekday: 'short' }).format(inst);
        periods.push({ inst, parts, dateKey, display, weekday });
      }
    }
    return periods;
  }

  // trigger re-render at midnight so blocks update automatically
  const [nowTick, setNowTick] = useState<Date>(new Date());
  useEffect(() => {
    // compute ms until next local midnight
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const delay = next.getTime() - now.getTime();
    const t = setTimeout(() => {
      setNowTick(new Date());
      // after first tick, update every 24h
      const iv = setInterval(() => setNowTick(new Date()), 24 * 60 * 60 * 1000);
      // store interval id on closure — clear on cleanup
      (t as any)._iv = iv;
    }, delay);
    return () => {
      clearTimeout(t as any);
      if ((t as any)._iv) clearInterval((t as any)._iv);
    };
  }, []);

  // dynamic periods used for the left-hand list (recompute when nowTick or dateUnit changes)
  const periods = makePeriods(dateUnit, nowTick);
  const displayedPeriods = customDays || periods;

  function isWeekend(weekdayShort: string) {
    const w = weekdayShort.toLowerCase();
    return w.startsWith('sat') || w.startsWith('sun') || w.startsWith('lö') || w.startsWith('sö');
  }

  function slotsForDay(day: any) {
    const weekend = isWeekend(day.weekday);
    const start = weekend ? (12 * 60) : (10 * 60 + 30); // minutes
    const end = weekend ? (23 * 60) : (21 * 60); // exclusive end
    const step = 30;
    const slots: { key: string; label: string; hour: number; minute: number }[] = [];
    for (let m = start; m <= end - step; m += step) {
      const hour = Math.floor(m / 60);
      const minute = m % 60;
      const key = makeSlotKey(day.dateKey, hour, minute);
      slots.push({ key, label: `${pad(hour)}:${pad(minute)}`, hour, minute });
    }
    return slots;
  }

  useEffect(() => {
    if (pendingSlot && emailRef.current) {
      emailRef.current.focus();
    }
  }, [pendingSlot]);

  function handleSlotClick(slotKey: string) {
    if (bookedSlots.includes(slotKey)) return;
    setPendingSlot(slotKey);
    setConfirmVisible(false);
  }

  function handleEmailKeyDown(e: any) {
    if (e.key === 'Enter' && pendingSlot) {
      // show confirmation dialog
      setConfirmVisible(true);
    }
  }

  // fetch booked slots for the visible period (range) from backend
  useEffect(() => {
    if (!periods || periods.length === 0) return;
    const from = periods[0].dateKey;
    const to = periods[periods.length - 1].dateKey;
    async function fetchAvailabilityRange() {
      try {
        const res = await fetch(`http://localhost:4000/api/availability?from=${from}&to=${to}`);
        if (!res.ok) return;
        const data = await res.json();
        // build booked slot keys for the entire range
        const newSlots: string[] = (data.booked || []).flatMap((b: any) => {
          return [`${b.date}T${b.time}`];
        });
        setBookedSlots(newSlots);
      } catch (e) {
        // ignore availability fetch errors for now
      }
    }
    fetchAvailabilityRange();
  }, [periods, nowTick]);

  async function doConfirmBooking() {
    if (!pendingSlot) return;
    setLoading(true);
    setError(null);
    const [dateKey, time] = pendingSlot.split('T');
    if (!name.trim()) {
      setError('Vänligen ange ditt namn');
      setLoading(false);
      if (nameRef.current) nameRef.current.focus();
      return;
    }
    try {
      const res = await fetch('http://localhost:4000/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateKey, time, email: email.trim().toLowerCase(), name: name.trim(), partySize }),
      });

      if (res.status === 201) {
        // success
        setBookedSlots((prev: string[]) => [...prev, pendingSlot]);
        setConfirmation(pendingSlot);
        setPendingSlot(null);
        setEmail('');
        setName('');
        setConfirmVisible(false);
        setTimeout(() => setConfirmation(null), 4000);
      } else if (res.status === 202) {
        // accepted but email failed
        setBookedSlots((prev: string[]) => [...prev, pendingSlot]);
        setConfirmation(pendingSlot);
        setPendingSlot(null);
        setEmail('');
        setConfirmVisible(false);
        setTimeout(() => setConfirmation(null), 4000);
        setError('Booking saved but confirmation email failed to send');
      } else if (res.status === 409) {
        // conflict - refresh availability
        setError('Tiden är redan bokad. Uppdaterar tillgänglighet.');
        const dateKey = pendingSlot.split('T')[0];
        try {
          const r2 = await fetch(`http://localhost:4000/api/availability?date=${dateKey}`);
          if (r2.ok) {
            const d2 = await r2.json();
            const newSlots = (d2.booked || []).map((b: any) => `${dateKey}T${b.time}`);
            setBookedSlots((prev: string[]) => {
              const others = prev.filter(s => !s.startsWith(`${dateKey}T`));
              return [...others, ...newSlots];
            });
          }
        } catch (e) {}
      } else {
        const txt = await res.text();
        setError(`Fel vid bokning: ${res.status} ${txt}`);
      }
    } catch (e: any) {
      setError(e.message || 'Nätverksfel vid bokning');
    } finally {
      setLoading(false);
    }
  }

  function cancelPending() {
    setPendingSlot(null);
    setEmail('');
    setConfirmVisible(false);
  }

  // When confirmation dialog is visible, allow Enter to confirm and Escape to cancel
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!confirmVisible) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        doConfirmBooking();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelPending();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmVisible, pendingSlot, name, email, partySize]);

  return (
    <div className="w-full max-w-4xl mx-auto bg-white/6 p-8 rounded-2xl border border-white/10">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-4xl font-bold">Bokning</h3>
          <p className="text-base text-white/70">Välj datum och tid (Svensk tid)</p>
        </div>
        <div className="flex items-center gap-4">
          {confirmation ? (
            <div className="flex items-center gap-3 text-green-300 font-bold">
              <span>Din bokning är tagen!</span>
              <Check className="w-6 h-6" />
            </div>
          ) : (
            <button onClick={onClose} className="text-base px-4 py-2 bg-white/10 rounded">Stäng</button>
          )}
        </div>
      </div>

      <div className="flex gap-6">
          <div className="w-44 shrink-0">
            <div className="flex items-center justify-between mb-2 -mt-4">
              <div className="text-orange-400 font-semibold">{viewLevel === 'years' ? 'År' : viewLevel === 'months' ? 'Månader' : viewLevel === 'weeks' ? 'Veckor' : 'Dagar'}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setViewLevel('years')} className={`text-sm px-2 py-1 rounded ${viewLevel==='years' ? 'bg-orange-500/20 text-orange-300' : 'bg-white/5'}`}>År</button>
                <button onClick={() => setViewLevel('months')} className={`text-sm px-2 py-1 rounded ${viewLevel==='months' ? 'bg-orange-500/20 text-orange-300' : 'bg-white/5'}`}>Månader</button>
              </div>
            </div>

            <div className="space-y-2">
              {viewLevel === 'years' && (
                // show selectable years 2026..2030
                [2026,2027,2028,2029,2030].map(y => (
                  <button key={`year_${y}`} onClick={() => { setSelectedYear(y); setViewLevel('months'); setSelectedMonth(null); setCustomDays(null); }} className={`w-full text-left px-4 py-3 rounded hover:bg-white/5`}>
                    <div className="text-base text-white/60">{y}</div>
                  </button>
                ))
              )}

              {viewLevel === 'months' && (
                (() => {
                  const monthsList: { year: number; month: number }[] = [];
                  if (selectedYear === 2026) {
                    // keep Dec 2025 then Jan-Dec 2026
                    monthsList.push({ year: 2025, month: 11 });
                    for (let mi = 0; mi < 12; mi++) monthsList.push({ year: 2026, month: mi });
                  } else if (selectedYear) {
                    for (let mi = 0; mi < 12; mi++) monthsList.push({ year: selectedYear, month: mi });
                  } else {
                    // fallback: show 2026 with Dec 2025
                    monthsList.push({ year: 2025, month: 11 });
                    for (let mi = 0; mi < 12; mi++) monthsList.push({ year: 2026, month: mi });
                  }
                  return monthsList.map((mobj) => {
                    const inst = new Date(mobj.year, mobj.month, 1);
                    const display = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' }).format(inst);
                    return (
                      <button
                        key={`month_${mobj.year}_${mobj.month}`}
                        onClick={() => {
                          setSelectedMonth({ year: mobj.year, month: mobj.month });
                          setViewLevel('weeks');
                          setSelectedWeek(null);
                          setCustomDays(null);
                        }}
                        className={`w-full text-left px-4 py-3 rounded hover:bg-white/5`}
                      >
                        <div className="text-base text-white/60">{display}</div>
                      </button>
                    );
                  });
                })()
              )}

              {viewLevel === 'weeks' && selectedMonth && (
                // show 4 weeks for selected month
                (() => {
                  const { year, month } = selectedMonth;
                  const lastDay = new Date(year, month + 1, 0).getDate();
                  const weeks = [ {start:1,end:7}, {start:8,end:14}, {start:15,end:21}, {start:22,end:lastDay} ];
                  return weeks.map((w, idx) => {
                    return (
                      <button key={`week_${idx}`} onClick={() => {
                        // build days for that week
                        const days = [];
                        for (let d = w.start; d <= w.end; d++) {
                          const inst = new Date(selectedMonth.year, selectedMonth.month, d);
                          const parts = getStockholmParts(inst);
                          const dateKey = makeDateKeyFromParts(parts);
                          const display = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'short', day: '2-digit', month: 'short' }).format(inst);
                          const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Stockholm', weekday: 'short' }).format(inst);
                          days.push({ inst, parts, dateKey, display, weekday });
                        }
                        setCustomDays(days);
                        setViewLevel('days');
                        setSelectedWeek(idx + 1);
                        setSelectedIndex(0);
                      }} className={`w-full text-left px-4 py-3 rounded hover:bg-white/5`}>
                        <div className="text-base text-white/60">Vecka {idx+1}</div>
                        <div className="text-sm text-white/40">{w.start}–{w.end}</div>
                      </button>
                    );
                  });
                })()
              )}

              {viewLevel === 'days' && displayedPeriods.map((d, i) => (
                <button
                  key={d.dateKey + '_' + i}
                  onClick={() => setSelectedIndex(i)}
                  className={`w-full text-left px-4 py-3 rounded ${i===selectedIndex? 'bg-white/10':'hover:bg-white/5'}`}
                >
                  <div className="text-base text-white/60">{d.display}</div>
                  <div className="text-base font-semibold">{d.dateKey}</div>
                </button>
              ))}
            </div>

            {/* Back button when in deeper levels */}
            <div className="mt-3">
              {viewLevel === 'weeks' && (
                <button onClick={() => { setViewLevel('months'); setSelectedMonth(null); setSelectedWeek(null); }} className="text-sm px-3 py-2 bg-white/5 rounded">Tillbaka</button>
              )}
              {viewLevel === 'days' && customDays && (
                <button onClick={() => { setViewLevel('weeks'); setCustomDays(null); setSelectedWeek(null); }} className="text-sm px-3 py-2 bg-white/5 rounded">Tillbaka</button>
              )}
              {viewLevel === 'months' && (
                <button onClick={() => { setViewLevel('years'); setSelectedYear(null); setSelectedMonth(null); }} className="text-sm px-3 py-2 bg-white/5 rounded">Tillbaka</button>
              )}
            </div>
          </div>

        <div className="flex-1">
          <div className="mb-4 mt-6">
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                <label className="block text-base text-white/70 mb-2">Namn</label>
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="För- och efternamn"
                  className="w-full px-4 py-3 rounded bg-white/5 border border-white/10 text-base mb-3"
                />
              </div>
              <div className="w-36">
                <label className="block text-base text-white/70 mb-2">Antal personer</label>
                <select
                  value={String(partySize)}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  className="w-full px-3 py-3 rounded bg-gray-800 border border-gray-700 text-base font-semibold text-orange-500 focus:border-orange-400 focus:ring-2 focus:ring-orange-400"
                >
                  {[1,2,3,4,5,6,7,8].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="block text-base text-white/70 mb-2">Email</label>
            <input
              ref={emailRef}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleEmailKeyDown}
              placeholder="din@epost.se"
              className="w-full px-4 py-3 rounded bg-white/5 border border-white/10 text-base"
            />
            <div className="flex items-center justify-between mt-2">
              <div className="text-sm text-white/50">Fyll i namn, antal personer och epost. Tryck Enter i epostfältet för att bekräfta bokningen.</div>
              <button
                onClick={() => setConfirmVisible(true)}
                title="Bekräfta"
                className="ml-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-md"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {(() => {
              const isClosedDay = displayedPeriods[selectedIndex].dateKey === '2025-12-24';
              return slotsForDay(displayedPeriods[selectedIndex]).map(s => {
                const disabled = bookedSlots.includes(s.key) || isClosedDay;
                return (
                  <button
                    key={s.key}
                    onClick={() => handleSlotClick(s.key)}
                    disabled={disabled}
                    className={`px-4 py-3 rounded text-base font-medium ${disabled ? 'bg-white/10 text-white/40 cursor-not-allowed line-through' : (pendingSlot===s.key ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10')}`}
                  >
                    {s.label}
                  </button>
                );
              });
            })()}
          </div>

          {displayedPeriods[selectedIndex].dateKey === '2025-12-24' && (
            <div className="mt-3 text-base text-white/50 font-semibold">Stängt den här dagen!</div>
          )}

          {confirmVisible && pendingSlot && (
            <div className="mt-4 p-4 bg-white/8 rounded-md border border-white/15">
              <div className="mb-3 text-sm">Är du säker att du vill boka den tiden?</div>
              <div className="flex gap-3">
                <button onClick={doConfirmBooking} className="px-4 py-2 bg-green-600 rounded text-white">Ja</button>
                <button onClick={cancelPending} className="px-4 py-2 bg-white/10 rounded">Nej</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 3D Glass Card Component with Enhanced Effects + Fade Out
function GlassCard3D({ children, className = "", delay = 0, index = 0, size = "normal", noFade = false }: any) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, margin: "-100px", amount: 0.3 });
  
  const sizeClasses = {
    normal: "p-12",
    large: "p-16",
    xlarge: "p-20"
  };
  
  const active = isInView || noFade;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 80, rotateX: -20, scale: 0.88 }}
      animate={active ? {
        opacity: 1,
        y: 0,
        rotateX: 0,
        scale: 1
      } : {
        opacity: 0,
        y: 60,
        rotateX: -15,
        scale: 0.9
      }}
      transition={{
        duration: 1.4,
        delay: active ? (delay + (index * 0.18)) : 0,
        ease: [0.22, 1, 0.36, 1]
      }}
      whileHover={{
        scale: 1.12,
        rotateY: 7,
        rotateX: 5,
        y: -12,
        transition: { duration: 0.5, ease: "easeOut" }
      }}
      className={`
        relative group perspective-1000
        bg-white/10 backdrop-blur-[50px] 
        border-2 border-white/25 
        rounded-[56px] ${sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.normal}
        shadow-[0_20px_60px_rgba(0,0,0,0.22),inset_0_0_40px_rgba(255,255,255,0.12)]
        hover:shadow-[0_35px_90px_rgba(228,130,22,0.4),inset_0_0_70px_rgba(255,255,255,0.18)]
        hover:border-orange-400/40
        transition-all duration-600
        ${className}
      `}
      style={{
        transformStyle: "preserve-3d",
        transform: "translateZ(0)"
      }}
    >
          <div className="absolute inset-0 rounded-[56px] bg-linear-to-br from-orange-500/5 via-transparent to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-600" />
          <div className="absolute inset-0 rounded-[56px] bg-linear-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-600" />
      {children}
    </motion.div>
  );
}

// Floating Image Testimonial
function FloatingTestimonial({ image, name, role, delay = 0, index = 0 }: any) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, margin: "-80px", amount: 0.3 });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 100, rotateX: -25, scale: 0.85 }}
      animate={isInView ? { 
        opacity: 1, 
        y: 0, 
        rotateX: 0, 
        scale: 1 
      } : {
        opacity: 0,
        y: 80,
        rotateX: -20,
        scale: 0.88
      }}
      transition={{
        duration: 1.5,
        delay: isInView ? (delay + (index * 0.2)) : 0,
        ease: [0.22, 1, 0.36, 1]
      }}
      whileHover={{
        scale: 1.15,
        y: -20,
        rotateY: 8,
        rotateX: 5,
        transition: { duration: 0.5, ease: "easeOut" }
      }}
      className="relative group perspective-1000"
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* White shadow underneath */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[90%] h-8 bg-white/20 blur-2xl rounded-full group-hover:w-[95%] group-hover:bg-white/30 transition-all duration-500" />
      
      {/* Glass Frame */}
      <div className="relative overflow-hidden rounded-[48px] bg-white/10 backdrop-blur-[45px] border-2 border-white/30 shadow-[0_25px_70px_rgba(0,0,0,0.25),inset_0_0_50px_rgba(255,255,255,0.15)] group-hover:shadow-[0_40px_100px_rgba(228,130,22,0.45),inset_0_0_80px_rgba(255,255,255,0.22)] group-hover:border-orange-400/50 transition-all duration-600">
        {/* Image */}
        <div className="relative overflow-hidden rounded-t-[44px]">
          <img 
            src={image} 
            alt={name}
            className="w-full h-80 object-cover group-hover:scale-110 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-linear-to-t from-[#111215]/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
        
        {/* Content */}
        <div className="p-8 relative z-10">
          <div className="flex gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-orange-400 text-orange-400 group-hover:scale-125 transition-transform duration-300" style={{ transitionDelay: `${i * 50}ms` }} />
            ))}
          </div>
          <h3 className="text-2xl font-bold mb-2 bg-linear-to-r from-white to-orange-200 bg-clip-text text-transparent">
            {name}
          </h3>
          <p className="text-white/70 text-lg">{role}</p>
        </div>
      </div>
    </motion.div>
  );
}

// Stats Counter Component
function StatsCounter({ value, label, icon: Icon, delay = 0 }: any) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, amount: 0.4 });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.8, rotateX: -20 }}
      animate={isInView ? { 
        opacity: 1, 
        scale: 1, 
        rotateX: 0 
      } : {
        opacity: 0,
        scale: 0.85,
        rotateX: -15
      }}
      transition={{ duration: 1.2, delay: isInView ? delay : 0, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{
        scale: 1.15,
        rotateY: 8,
        rotateX: 5,
        y: -15
      }}
      className="relative p-12 rounded-[52px] bg-linear-to-br from-orange-500/20 to-orange-600/20 backdrop-blur-[45px] border-2 border-orange-400/30 shadow-[0_25px_70px_rgba(228,130,22,0.3),inset_0_0_50px_rgba(255,255,255,0.15)] hover:shadow-[0_40px_100px_rgba(228,130,22,0.5),inset_0_0_80px_rgba(255,255,255,0.25)] hover:border-orange-400/60 transition-all duration-600 group"
      style={{ transformStyle: "preserve-3d" }}
    >
      <Icon className="w-14 h-14 text-orange-400 mb-6 group-hover:scale-125 group-hover:rotate-12 transition-all duration-500" />
      <div className="text-7xl font-bold bg-linear-to-r from-orange-300 to-orange-400 bg-clip-text text-transparent mb-4 drop-shadow-[0_0_30px_rgba(228,130,22,0.6)]">
        {value}
      </div>
      <div className="text-white/70 text-xl font-medium">{label}</div>
    </motion.div>
  );
}

// Main App 
function App() {
  const { scrollYProgress } = useScroll();
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "80%"]);
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, -200]);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollAnimationRef = useRef<number | null>(null);
  const footerControls = useAnimation();
  // Booking state
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactStatus, setContactStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle');

  async function submitContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactMessage) {
      setContactStatus('error');
      return;
    }
    setContactStatus('sending');
    try {
      const res = await fetch((process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4000') + '/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: contactName, email: contactEmail, message: contactMessage }),
      });
      if (!res.ok) throw new Error(await res.text());
      setContactStatus('sent');
      setContactName(''); setContactEmail(''); setContactMessage('');
    } catch (err) {
      console.error(err);
      setContactStatus('error');
    }
  }

  useEffect(() => {
    // Removed localStorage hydration to ensure server is authoritative for booked slots
  }, []);

  useEffect(() => {
    // Removed localStorage persistence so UI reflects server availability only
  }, [bookedSlots]);
  
  

  return (
    <div className="min-h-screen bg-[#111215] text-white overflow-hidden relative">
      {/* Animated Background: single black overlay (removed colored blobs) */}
      <motion.div
        style={{ y: bgY }}
        className="fixed inset-0"
      >
        <div className="absolute inset-0 bg-[#111215]/70" />
      </motion.div>

      {/* Combined Hero Background (Nav + Hero) */}
      <div className="relative min-h-screen">
        {/* Background Image with Parallax - Covers Nav + Hero */}
        <motion.div 
          style={{ 
            y: useTransform(scrollYProgress, [0, 0.5], [0, 100])
          }}
          className="absolute inset-0 w-full h-full overflow-hidden z-0"
        >
          <video
            className="absolute inset-0 w-full h-full object-cover scale-110"
            src="/Cooking.mp4"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          />
          {/* Single dark overlay for readability */}
          <div className="absolute inset-0 bg-[#111215]/80 z-20" />
          {/* Subtle glass blur */}
          <div className="absolute inset-0 backdrop-blur-[1px] z-30" />
        </motion.div>

        {/* Navigation */}
        <motion.nav 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="relative z-50 px-8 py-8 flex justify-between items-center max-w-7xl mx-auto"
        >
          <div className="flex items-center gap-4">
            <motion.div
              whileHover={{ rotate: 360, scale: 1.1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="w-24 h-24 flex items-center justify-center"
              style={{ transformOrigin: '50% 50%' }}
            >
              <img
                src={CIBO_ICON}
                alt="CIBO Italo-Americano"
                className="w-24 h-24 object-contain"
              />
            </motion.div>
            <div>
              <span className="text-3xl font-bold tracking-tight block">CIBO</span>
              <span className="text-xs text-orange-400 font-medium">Italo-Americano</span>
            </div>
          </div>
          
          <div className="hidden lg:flex gap-10 text-white/70 font-medium text-lg">
            <a href="#about" className="hover:text-orange-400 transition-colors duration-300 text-lg md:text-xl px-3 py-2 font-semibold">Om Oss</a>
            <a href="#menu" className="hover:text-orange-400 transition-colors duration-300 text-lg md:text-xl px-3 py-2 font-semibold">Meny</a>
            <a href="#contact" className="hover:text-orange-400 transition-colors duration-300 text-lg md:text-xl px-3 py-2 font-semibold">Kontakt</a>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.08, boxShadow: "0 0 60px rgba(228, 130, 22, 0.7)" }}
            whileTap={{ scale: 0.98 }}
            className="px-10 py-5 rounded-full bg-linear-to-r from-orange-500 to-orange-600 font-bold text-lg shadow-[0_0_40px_rgba(228,130,22,0.5)] border border-orange-400/30"
            onClick={() => {
              const el = document.getElementById('book');
              if (el) {
                const offset = 280; // px to leave more space above the section
                const y = el.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top: y, behavior: 'smooth' });
              }
            }}
          >
            Boka bord
          </motion.button>
        </motion.nav>

        {/* Hero Section - Expanded */}
        <motion.section 
          style={{ y: heroY }}
          className="relative z-10 px-8 pt-20 pb-40 flex items-center"
        >
          <div className="grid lg:grid-cols-2 gap-20 items-center relative z-40 w-full max-w-7xl mx-auto">
          {/* Left Content */}
          <div className="space-y-10">
            <motion.div
              initial={{ opacity: 0, x: -80, rotateY: -10 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            >
              

              <h1 className="text-8xl md:text-9xl lg:text-[110px] font-bold leading-none mb-8 tracking-tight">
                <motion.span 
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.2, delay: 0.5 }}
                  className="block bg-linear-to-r from-orange-300 via-orange-200 to-white bg-clip-text text-transparent drop-shadow-[0_0_50px_rgba(228,130,22,0.8)]"
                >
                  CIBO
                </motion.span>
                <motion.span 
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.2, delay: 0.7 }}
                  className="block text-white drop-shadow-[0_0_40px_rgba(228,130,22,0.6)]"
                >
                  Italo-Americano
                </motion.span>
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.9 }}
                className="text-2xl md:text-3xl text-white/70 leading-relaxed max-w-2xl font-light"
              >
                Sveriges godaste restaurang med bästa matupplevelsen.
              </motion.p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row gap-6"
            >
              {/* Buttons removed per request */}
            </motion.div>

            
          </div>

          {/* Right - 3D Glass Card Stack (Larger) */}
          <motion.div
            initial={{ opacity: 0, x: 80, rotateY: 10 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-175 perspective-2000"
          >
            {/* Hero pizza removed per request */}
          </motion.div>
        </div>

        {/* Hero-only scroll indicator (absolute inside hero, does not follow page) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50"
        >
          <motion.button
            onClick={() => {
              if (isScrolling) {
                if (scrollAnimationRef.current) {
                  cancelAnimationFrame(scrollAnimationRef.current);
                  scrollAnimationRef.current = null;
                }
                setIsScrolling(false);
                return;
              }

              // Start scrolling toward the in-page "about" section
              setIsScrolling(true);
              const start = window.scrollY;
              const aboutEl = document.getElementById('about');
              const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
              let target = Math.min(maxScroll, Math.max(0, (aboutEl?.getBoundingClientRect().top || 0) + window.scrollY));

              if (aboutEl instanceof HTMLElement) {
                // keep the existing negative offset behavior
                const offset = -80;
                const aboutTop = aboutEl.getBoundingClientRect().top + window.scrollY;
                target = Math.min(maxScroll, Math.max(0, aboutTop - offset));
              }

              const remainingDistance = Math.max(0, target - start);
              // slow down a little more for a gentler feel
              const speedPxPerMs = 2; // slightly slower
              const duration = Math.max(450, Math.round(remainingDistance / speedPxPerMs));
              const startTime = performance.now();

              const smoothScroll = (currentTime: number) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease = progress < 0.5
                  ? 4 * progress * progress * progress
                  : 1 - Math.pow(-2 * progress + 2, 3) / 2;

                window.scrollTo(0, start + remainingDistance * ease);

                if (progress < 1) {
                  scrollAnimationRef.current = requestAnimationFrame(smoothScroll);
                } else {
                  setIsScrolling(false);
                  scrollAnimationRef.current = null;
                }
              };

              scrollAnimationRef.current = requestAnimationFrame(smoothScroll);
            }}
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            whileHover={{ scale: 1.1, boxShadow: "0 0 40px rgba(228, 130, 22, 0.5)" }}
            whileTap={{ scale: 0.95 }}
            className={`w-16 h-16 rounded-full backdrop-blur-xl border transition-all duration-300 cursor-pointer flex items-center justify-center ${
              isScrolling 
                ? 'bg-orange-500/30 border-orange-400/60 text-white shadow-[0_0_40px_rgba(228,130,22,0.6)]'
                : 'bg-white/10 border-white/20 text-white/70 hover:bg-orange-500/20 hover:border-orange-400/40 hover:text-white'
            }`}
          >
            <ChevronDown className="w-6 h-6" />
          </motion.button>
        </motion.div>

      </motion.section>
      </div>

      

      {/* About Section */}
      <section id="about" className="relative z-10 px-8 py-40 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 1.2 }}
          className="text-center mb-24"
        >
          <h2 className="text-7xl md:text-8xl font-bold mb-8 bg-linear-to-r from-orange-300 via-orange-200 to-white bg-clip-text text-transparent">
            <span className="text-orange-400">Lyxig</span> Italiensk & Amerikansk Mat </h2>
          <p className="text-2xl text-white/70 max-w-4xl mx-auto leading-relaxed">
            CIBO Italo-Americano är ett passionerat kök som förenar det bästa av italiensk och amerikansk matkultur. Vår meny är noggrant utformad för att erbjuda autentiska smaker och en minnesvärd matupplevelse i hjärtat av Stockholm.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotateX: -15 }}
          whileInView={{ opacity: 1, scale: 1, rotateX: 0 }}
          animate={{ opacity: 0, scale: 0.9, rotateX: -15 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 1.5 }}
          whileHover={{ scale: 1.05, rotateY: 3 }}
          className="pt-10 pb-56 px-20 rounded-none bg-linear-to-br from-orange-500/20 to-orange-600/20 backdrop-blur-[55px] border-2 border-orange-400/40 shadow-[0_40px_110px_rgba(228,130,22,0.4),inset_0_0_70px_rgba(255,255,255,0.2)] hover:shadow-[0_55px_140px_rgba(228,130,22,0.6)] hover:border-orange-400/60 transition-all duration-600"
          style={{ transformStyle: "preserve-3d" }}
        >
          <div className="text-center space-y-2">
            <h3 className="text-5xl md:text-6xl font-bold bg-linear-to-r from-white to-orange-200 bg-clip-text text-transparent mb-1">
              Dagens Lunch
            </h3>
              <p className="text-base md:text-lg text-white/80 leading-relaxed max-w-4xl mx-auto">
              Här finns dagens lunchmeny.
            </p>
          </div>
        </motion.div>
      </section>

        {/* Menu Section */}
      <section id="menu" className="relative z-10 px-8 py-40 max-w-480 mx-auto">
        <AnimatedSection className="text-center mb-24" delay={0}>
          <h2 className="text-7xl md:text-8xl font-bold mb-8 bg-linear-to-r from-orange-300 via-orange-200 to-white bg-clip-text text-transparent">
            Våra Menyer
          </h2>
          <p className="text-2xl text-white/70 max-w-3xl mx-auto leading-relaxed">
           Kolla genom vår härliga meny med olika rätter, noggrant utvalda för att erbjuda en autentisk och minnesvärd matupplevelse.
          </p>
        </AnimatedSection>
        
        <div>
          {/* SVG sharpen filters: soft default + stronger on hover */}
          <svg aria-hidden="true" className="hidden">
            <filter id="sharpen-soft">
              <feConvolveMatrix order="3" kernelMatrix="0 -0.25 0 -0.25 2 -0.25 0 -0.25 0" />
            </filter>
            <filter id="sharpen">
              <feConvolveMatrix order="3" kernelMatrix="0 -1 0 -1 5 -1 0 -1 0" />
            </filter>
          </svg>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { image: '/menues/menu1.jpg' },
            { image: '/menues/menu5.jpg' },
            { image: '/menues/menu2.jpg' },
            { image: '/menues/menu3.jpg' },
            { image: '/menues/menu4.jpg' },
          ].map((service, i) => {
            const positionClass = i >= 3 ? (i === 3 ? 'md:col-start-2 lg:col-start-2 transform md:-translate-x-34 lg:-translate-x-80' : 'md:col-start-2 lg:col-start-3 transform md:-translate-x-34 lg:-translate-x-80') : '';
            return (
              <GlassCard3D
                key={i}
                index={i}
                delay={0.2}
                size="large"
                className={`group rounded-none overflow-hidden p-0! h-112 md:h-160 lg:h-208 ${positionClass}`}
                noFade
              >
                <img
                  src={service.image}
                  alt=""
                  style={{ willChange: 'transform', transform: 'translateZ(0)' }}
                  className="absolute inset-0 w-full h-full object-contain object-center p-0 transform-gpu scale-[1.03] transition-transform duration-200 filter-[url(#sharpen-soft)] hover:scale-[1.06] group-hover:filter-[url(#sharpen)]"
                />
                <div className="absolute inset-0 bg-black/10" />
              </GlassCard3D>
            );
          })}
        </div>
      </section>


      

      {/* Gallery Section */}
      <section id="gallery" className="relative z-10 px-8 py-40 max-w-480 mx-auto">
        <AnimatedSection className="text-center mb-24" delay={0}>
          <h2 className="text-7xl md:text-8xl font-bold mb-8 bg-linear-to-r from-orange-300 via-orange-200 to-white bg-clip-text text-transparent">
            Galleri
          </h2>
          <p className="text-2xl text-white/70 max-w-3xl mx-auto leading-relaxed">
            En fin samling av bilder från vår restaurang, mat och atmosfär som fångar essensen av Cibo Italo-Americano.
          </p>
        </AnimatedSection>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { image: '/menues/image1.jpg' },
            { image: '/menues/image2.jpg' },
            { image: '/menues/image3.jpg' },
            { image: '/menues/image4.jpg' },
            { image: '/menues/image5.jpg' },
            { image: '/menues/image6.jpg' },
            { image: '/menues/image7.jpg' },
            { image: '/menues/image8.jpg' },
            { image: '/menues/image9.jpg' }
          ].map((service, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.25 }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-none overflow-hidden p-0! h-80 md:h-96 lg:h-120"
            >
              <GlassCard3D
                index={i}
                delay={0.2}
                size="large"
                className="group rounded-none overflow-hidden p-0! h-full"
                noFade
              >
                <img src={service.image} alt="" className="absolute inset-0 w-full h-full object-cover filter brightness-105" />
                <div className="absolute inset-0 bg-black/10" />
              </GlassCard3D>
            </motion.div>
          ))}
        </div>
      </section>



      {/* Success Stories with Text */}
      <section className="relative z-10 px-8 py-40 max-w-7xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          className="text-7xl font-bold text-center mb-28 bg-linear-to-r from-white to-orange-200 bg-clip-text text-transparent"
        >
          Kundnöjdhet
        </motion.h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
          {[
            { 
              quote: "Mysigt plats,god mat med ny ägare. Mat: 5/5  |  Tjänst: 5/5  |  Atmosfär: 5/5.",
              metric: "Kund",
              metricLabel: ""
            },
            { 
              quote: "Ett riktigt mysigt ställe i Hammarby Sjöstad med skön atmosfär och hjärtlig känsla. Jag har ätit deras plankstek flera gånger, och den är helt fantastisk – saftig entrecôte, perfekt tillagad och med riktigt bra tillbehör. Ägaren är supertrevlig och det märks att han jobbar med bra råvaror och bryr sig om kvaliteten på menyn. Det här är ett ställe man gärna kommer tillbaka till, både för maten och bemötandet. Rekommenderas varmt om du vill ha god mat i en avslappnad och trivsam miljö! 🍽️🔥",
              metric: "Kund",
              metricLabel: ""
            },
            {
              quote: "First of all there were no restaurants nearby which operated after 22:00 in the neighborhood, so that's the main reason we went here for dinner because trying Italian cuisine was not a part of my plan during the Sweden trip.\n\nFortunately the food and the ambience was very nice and service was also appreciated. Even in the late hours they were extremely enthusiastic and the fresh, hot lively prepared pizza was very good which gave the authentic Italian pizza flavour. Then we tried the carbonara which was also nice.\nMat: 4/5  |  Tjänst: 4/5  |  Atmosfär: 5/5",
              metric: "Kund",
              metricLabel: ""
            }
          ].map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 90, rotateX: -22, scale: 0.88 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
              viewport={{ once: false, margin: "-80px", amount: 0.3 }}
              transition={{ duration: 1.5, delay: i * 0.2, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{
                scale: 1.1,
                rotateY: 6,
                rotateX: 4,
                y: -15
              }}
              className={`p-12 ${(() => {
                const q = ((testimonial as any)?.quote || '');
                return (q.includes('Mysigt plats') || q.includes('Ett riktigt mysigt ställe') || q.includes('First of all')) ? 'rounded-none' : 'rounded-[56px]';
              })()} bg-white/10 backdrop-blur-[50px] border-2 border-white/25 shadow-[0_25px_70px_rgba(0,0,0,0.25),inset_0_0_50px_rgba(255,255,255,0.15)] hover:shadow-[0_40px_110px_rgba(228,130,22,0.5),inset_0_0_80px_rgba(255,255,255,0.22)] hover:border-orange-400/50 transition-all duration-600 group`}
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Metric Badge */}
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-linear-to-r from-orange-500/25 to-orange-600/25 backdrop-blur-xl border border-orange-400/40 mb-8 shadow-[0_10px_30px_rgba(228,130,22,0.3)]">
                <div className="text-3xl font-bold text-orange-300">{testimonial.metric}</div>
                <div className="text-sm text-white/70">{testimonial.metricLabel}</div>
              </div>

              <div className="flex gap-2 mb-6">
                {(() => {
                  const isTarget = (testimonial as any).quote && (testimonial as any).quote.includes('First of all there were no restaurants nearby');
                  return [...Array(5)].map((_, j) => (
                    <Star
                      key={j}
                      className={
                        `w-6 h-6 ${isTarget && j === 4 ? 'fill-white text-white' : 'fill-orange-400 text-orange-400'} group-hover:scale-125 transition-transform duration-300`
                      }
                      style={{ transitionDelay: `${j * 60}ms` }}
                    />
                  ));
                })()}
              </div>
              
              <p className="text-white/80 text-xl mb-8 italic leading-relaxed">
                "{testimonial.quote}"
              </p>
              
              <div className="flex items-center gap-5 pt-6 border-t border-white/15">
                <div>
                  <div className="font-bold text-xl text-white">{(testimonial as any).name || ''}</div>
                  <div className="text-white/60 text-base">{(testimonial as any).role || ''}</div>
                  <div className="text-orange-400 text-sm font-medium">{(testimonial as any).company || ''}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      

      {/* Location Map Section */}
      <section className="relative z-10 px-8 py-40 max-w-7xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          className="text-7xl font-bold text-center mb-12 bg-linear-to-r from-white to-orange-200 bg-clip-text text-transparent"
        >
          Hitta oss
        </motion.h2>

        <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
          <div className="w-full h-120 md:h-130">
            <iframe
              title="CIBO Italo-Americano - Hammarby allé 85"
              width="100%"
              height="100%"
              frameBorder="0"
              style={{ border: 0 }}
              src="https://www.google.com/maps?q=Hammarby+all%C3%A9+85,+120+63+Stockholm&z=15&output=embed"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="relative z-10 px-8 py-40 max-w-7xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          className="text-7xl font-bold text-center mb-28 bg-linear-to-r from-orange-300 to-white bg-clip-text text-transparent"
        >
          Kontakta oss
        </motion.h2>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Info Cards */}
          <div className="space-y-8">
            {[
              { 
                icon: MapPin, 
                title: "Besöksadress", 
                content: "Hammarby allé 85, 120 63 Stockholm" 
              },
              { 
                icon: Mail, 
                title: "E-post", 
                content: "hello@ciboitaloamericano.se" 
              },
              { 
                icon: Phone, 
                title: "Telefon", 
                content: "082204750" 
              }
            ].map((contact, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -60, rotateY: -10 }}
                whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 1.2, delay: i * 0.15 }}
                whileHover={{
                  scale: 1.08,
                  rotateY: 5,
                  x: 10
                }}
                className="p-10 rounded-none bg-white/10 backdrop-blur-[45px] border-2 border-white/25 shadow-[0_20px_60px_rgba(0,0,0,0.22)] hover:shadow-[0_30px_80px_rgba(228,130,22,0.4)] hover:border-orange-400/40 transition-all duration-500 group"
                style={{ transformStyle: "preserve-3d" }}
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-none bg-linear-to-br from-orange-500/30 to-orange-600/30 backdrop-blur-xl border border-orange-400/30 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                    <contact.icon className="w-8 h-8 text-orange-400" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2 text-white">{contact.title}</h4>
                    <p className="text-white/70 text-lg">{contact.content}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 60, rotateY: 10 }}
            whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 1.3 }}
            whileHover={{ scale: 1.03, rotateY: -2 }}
            className="p-14 rounded-none bg-white/10 backdrop-blur-[50px] border-2 border-white/25 shadow-[0_30px_90px_rgba(0,0,0,0.25)] hover:shadow-[0_40px_110px_rgba(228,130,22,0.4)] hover:border-orange-400/40 transition-all duration-600"
            style={{ transformStyle: "preserve-3d" }}
          >
            <h3 className="text-4xl font-bold mb-8 bg-linear-to-r from-white to-orange-200 bg-clip-text text-transparent">
              Skicka Ett Meddelande
            </h3>
            <form className="space-y-6" onSubmit={submitContact}>
              <div>
                <input 
                  type="text" 
                  placeholder="Ditt Namn" 
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-6 py-5 rounded-none bg-white/5 backdrop-blur-xl border border-white/20 text-white placeholder-white/50 focus:bg-white/10 focus:border-orange-400/40 focus:outline-none transition-all duration-300 text-lg"
                />
              </div>
              <div>
                <input 
                  type="email" 
                  placeholder="Din E-post" 
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-6 py-5 rounded-none bg-white/5 backdrop-blur-xl border border-white/20 text-white placeholder-white/50 focus:bg-white/10 focus:border-orange-400/40 focus:outline-none transition-all duration-300 text-lg"
                />
              </div>
              <div>
                <textarea 
                  rows={5}
                  placeholder="Ditt Meddelande" 
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  className="w-full px-6 py-5 rounded-none bg-white/5 backdrop-blur-xl border border-white/20 text-white placeholder-white/50 focus:bg-white/10 focus:border-orange-400/40 focus:outline-none transition-all duration-300 resize-none text-lg"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 0 50px rgba(228, 130, 22, 0.6)" }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full py-6 rounded-none bg-linear-to-r from-orange-500 to-orange-600 font-bold text-xl shadow-[0_0_40px_rgba(228,130,22,0.5)] border border-orange-400/30 hover:shadow-[0_0_60px_rgba(228,130,22,0.7)] transition-all duration-300"
              >
                {contactStatus === 'sending' ? 'Skickar…' : contactStatus === 'sent' ? 'Skickat' : 'Skicka Meddelande'}
              </motion.button>
              {contactStatus === 'error' && <p className="text-sm text-red-400 mt-2">Fel vid skickning — kontrollera fälten.</p>}
            </form>
          </motion.div>
        </div>
      </section>

     

      {/* Footer - Enhanced Glass */}
      <footer className="relative z-10 px-0 py-6 mt-0 bg-white/5 backdrop-blur-[45px] border-t border-white/15 shadow-[0_-10px_30px_rgba(0,0,0,0.25)]">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 1.3 }}
          className="max-w-7xl mx-auto p-16"
        >
          <div className="grid md:grid-cols-4 gap-16 mb-20">
            <div className="col-span-2">
              <div className="flex items-center gap-4">
                <motion.div 
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.8 }}
                  className="w-32 h-32 flex items-center justify-center"
                >
                  <img
                    src={CIBO_ICON}
                    alt="CIBO Italo-Americano"
                    className="w-32 h-32 object-contain"
                  />
                </motion.div>
                <div>
                  <span className="text-4xl md:text-5xl font-bold tracking-tight block">CIBO</span>
                  <span className="text-sm md:text-base text-orange-400 font-medium">Italo‑Americano</span>
                </div>
              </div>
              <br></br>
              <div className="space-y-3 text-white/70">
                <p className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-orange-400" />
                  Hammarby allé 85, 120 63 Stockholm
                </p>
                <p className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-orange-400" />
                  hello@ciboitaloamericano.se
                </p>
                <p className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-orange-400" />
                  082204750
                </p>
              </div>
            </div>
            
            <div>
              <h4 className="font-bold mb-6 text-xl text-white">Snabblänkar</h4>
              <ul className="space-y-4 text-lg text-white/70">
                <li><a href="#about" className="hover:text-orange-400 transition-colors duration-300 text-lg md:text-xl px-3 py-2 font-semibold">Om Oss</a></li>
                <li><a href="#services" className="hover:text-orange-400 transition-colors duration-300 text-lg md:text-xl px-3 py-2 font-semibold">Meny</a></li>
                <li><a href="#contact" className="hover:text-orange-400 transition-colors duration-300 text-lg md:text-xl px-3 py-2 font-semibold">Kontakt</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-6 text-xl text-white flex items-center gap-2">
                <span>Öppettider:</span>
                <Clock className="w-5 h-5 text-white/80" />
              </h4>
              <div className="space-y-2 text-lg text-white/70">
                <p>Måndag: 10:30-21:00</p>
                <p>Tisdag-Fredag: 10:30-22:00</p>
                <p>Lördag: 12:00-23:00</p>
                <p>Söndag: 12:00-21:00</p>
              </div>

              <div className="mt-24 flex justify-center">
                <motion.div
                  className="w-20 h-20 transform -translate-x-8"
                  animate={footerControls}
                  onTap={() => {
                    footerControls.set({ rotate: 0 });
                    footerControls.start({ rotate: 360, transition: { duration: 0.6, ease: 'easeOut' } });
                  }}
                  whileHover={{ scale: 1.08, rotate: 8 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ duration: 0.28 }}
                >
                  <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    <circle cx={50} cy={50} r={48} fill="#D9A063" />
                    <circle cx={50} cy={50} r={40} fill="#F6D8A8" />

                    <g stroke="#A45" strokeWidth={2} strokeLinecap="round" opacity={0.12}>
                      <line x1={50} y1={50} x2={50} y2={10} />
                      <line x1={50} y1={50} x2={85} y2={30} />
                      <line x1={50} y1={50} x2={15} y2={30} />
                      <line x1={50} y1={50} x2={85} y2={70} />
                      <line x1={50} y1={50} x2={15} y2={70} />
                    </g>

                    <ellipse cx={36} cy={40} rx={6} ry={4} fill="#8B1E1E" />
                    <ellipse cx={60} cy={44} rx={5} ry={4} fill="#8B1E1E" />
                    <ellipse cx={45} cy={62} rx={5} ry={3.5} fill="#8B1E1E" />

                    <path d="M70 30c1 2 4 3 6 1 2-2 1-5-1-6-2-1-5 0-5 0z" fill="#2F8F3E" />
                    <path d="M30 65c1 2 4 2 5 0 1-2-1-4-3-4-2 0-3 3-2 4z" fill="#2F8F3E" />

                    <circle cx={78} cy={50} r={4.8} fill="#B22222" />
                    <circle cx={69.8} cy={69.8} r={5} fill="#B22222" />
                    <circle cx={50} cy={78} r={5} fill="#B22222" />
                    <circle cx={30.2} cy={69.8} r={4.6} fill="#B22222" />
                    <circle cx={22} cy={50} r={4.8} fill="#B22222" />
                    <circle cx={30.2} cy={30.2} r={5} fill="#B22222" />
                    <circle cx={50} cy={22} r={4.6} fill="#B22222" />
                    <circle cx={69.8} cy={30.2} r={5} fill="#B22222" />
                    <circle cx={42} cy={56} r={4.4} fill="#B22222" />
                    <circle cx={50} cy={42} r={4} fill="#B22222" />
                    <circle cx={58} cy={56} r={4.2} fill="#B22222" />
                    <circle cx={50} cy={46} r={3} fill="#8B4513" opacity={0.4} />
                    <circle cx={50} cy={50} r={2.5} fill="#8B1E1E" />
                  </svg>
                </motion.div>
              </div>
            </div>
          </div>
          
          <div className="pt-12 border-t border-white/15 text-center text-white/50 text-lg">
            <p>© 2026 CIBO Italo-Americano. Alla rättigheter förbehållna.</p>
          </div>
        </motion.div>
      </footer>

      
    </div>
  );
}

// Trophy icon replacement (using Award)
const Trophy = Award;

export default App;

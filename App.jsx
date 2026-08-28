import { useState, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from "recharts";

const fmt = (n) => {
  if (n === undefined || n === null || isNaN(n) || !isFinite(n)) return "£0";
  const abs = Math.abs(Math.round(n));
  return (n < 0 ? "-£" : "£") + abs.toLocaleString("en-GB");
};
const fmtD = (n) => {
  if (n === undefined || n === null || isNaN(n) || !isFinite(n)) return "£0.00";
  const abs = Math.abs(n);
  return (n < 0 ? "-£" : "£") + abs.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const safe = (v, d = 0) => (isNaN(v) || !isFinite(v) ? d : v);

const TABS = ["Overview", "Tickets", "Costs", "Analysis", "Scenarios", "Charity Week", "Monte Carlo"];
const PRESETS = {
  "Affordable": { ebP: 18, stP: 23, fnP: 28 },
  "Balanced": { ebP: 20, stP: 25, fnP: 30 },
  "Higher Revenue": { ebP: 24, stP: 28, fnP: 32 },
};
const SCENARIO_PRESETS = {
  "Affordability-First": { attendance: 350, cateringPH: 22, ebP: 18, stP: 23, fnP: 28, decorBudget: 500, cashSpon: 500, maxLoss: 12000 },
  "Balanced": { attendance: 350, cateringPH: 25, ebP: 20, stP: 25, fnP: 30, decorBudget: 750, cashSpon: 1000, maxLoss: 10000 },
  "Low-Cost Event": { attendance: 350, cateringPH: 20, ebP: 18, stP: 22, fnP: 26, decorBudget: 300, cashSpon: 0, maxLoss: 8000 },
  "Premium Dinner": { attendance: 400, cateringPH: 30, ebP: 22, stP: 27, fnP: 32, decorBudget: 1200, cashSpon: 1500, maxLoss: 15000 },
  "Worst Case": { attendance: 280, cateringPH: 30, ebP: 18, stP: 23, fnP: 28, decorBudget: 750, cashSpon: 0, maxLoss: 10000 },
  "Best Case": { attendance: 400, cateringPH: 22, ebP: 20, stP: 25, fnP: 30, decorBudget: 500, cashSpon: 2000, maxLoss: 10000 },
};
const DEFAULT_AMENITIES = [
  { id: 1, name: "Photography", cost: 250, sponsored: 0 },
  { id: 2, name: "Photo Booth / Backdrop", cost: 100, sponsored: 0 },
  { id: 3, name: "Signage", cost: 50, sponsored: 0 },
  { id: 4, name: "Table Presentation", cost: 100, sponsored: 0 },
];

function Slider({ label, value, onChange, min, max, step = 1, prefix = "", suffix = "", info }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</label>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">{prefix}</span>
          <input type="number" value={value} onChange={e => onChange(clamp(Number(e.target.value) || 0, min, max))}
            className="w-20 text-right bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-sm text-white focus:border-emerald-500 focus:outline-none" step={step} min={min} max={max} />
          <span className="text-xs text-slate-500">{suffix}</span>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
      {info && <p className="text-xs text-slate-500 mt-0.5">{info}</p>}
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer mb-2">
      <div className={`w-9 h-5 rounded-full relative transition-colors ${value ? "bg-emerald-600" : "bg-slate-600"}`} onClick={() => onChange(!value)}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  );
}

function KPI({ label, value, sub, color = "text-white", size = "text-2xl", warn }) {
  return (
    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50">
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`${size} font-bold ${color} leading-tight`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
      {warn && <div className="text-xs text-amber-400 mt-1">⚠ {warn}</div>}
    </div>
  );
}

function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-slate-800/60 rounded-xl border border-slate-700/50 ${className}`}>
      {title && <div className="px-4 py-3 border-b border-slate-700/50 text-sm font-semibold text-slate-200">{title}</div>}
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function CWSimulator() {
  const [tab, setTab] = useState(0);
  const [attendance, setAttendance] = useState(350);
  const [paidRate, setPaidRate] = useState(100);
  const [ticketMode, setTicketMode] = useState("detailed");
  const [ebP, setEbP] = useState(18);
  const [ebQ, setEbQ] = useState(100);
  const [stP, setStP] = useState(23);
  const [stQ, setStQ] = useState(200);
  const [fnP, setFnP] = useState(28);
  const [fnQ, setFnQ] = useState(50);
  const [simpleAvg, setSimpleAvg] = useState(22);
  const [hallNet, setHallNet] = useState(4000);
  const [vatRate] = useState(20);
  const [kitchenNet, setKitchenNet] = useState(750);
  const [kitchenReq, setKitchenReq] = useState(true);
  const [security, setSecurity] = useState(688.20);
  const [deposit, setDeposit] = useState(400);
  const [depositReturned, setDepositReturned] = useState(true);
  const [cateringPH, setCateringPH] = useState(25);
  const [cateringBuffer, setCateringBuffer] = useState(5);
  const [decorBudget, setDecorBudget] = useState(750);
  const [decorSpon, setDecorSpon] = useState(0);
  const [amenityItems, setAmenityItems] = useState(DEFAULT_AMENITIES);
  const [nextAmenityId, setNextAmenityId] = useState(5);
  const [mainAuction, setMainAuction] = useState(500);
  const [silentAuction, setSilentAuction] = useState(0);
  const [otherExp, setOtherExp] = useState(0);
  const [contingencyPct, setContingencyPct] = useState(7.5);
  const [useContingency, setUseContingency] = useState(false);
  const [cwFundraising, setCwFundraising] = useState(60000);
  const [cwSupportPct, setCwSupportPct] = useState(20);
  const [cwInitial, setCwInitial] = useState(8000);
  const [cwDinnerAlloc, setCwDinnerAlloc] = useState(6000);
  const [cwOtherCosts, setCwOtherCosts] = useState(2000);
  const [cashSpon, setCashSpon] = useState(0);
  const [inKindSpon, setInKindSpon] = useState(0);
  const [maxLoss, setMaxLoss] = useState(10000);
  const [hallDiscount, setHallDiscount] = useState(0);
  const [kitchenDiscount, setKitchenDiscount] = useState(0);
  const [cateringSaving, setCateringSaving] = useState(0);
  const [scenarios, setScenarios] = useState([]);
  const [scenarioName, setScenarioName] = useState("");
  const [mcAttLo, setMcAttLo] = useState(300);
  const [mcAttHi, setMcAttHi] = useState(400);
  const [mcCatLo, setMcCatLo] = useState(20);
  const [mcCatHi, setMcCatHi] = useState(30);
  const [mcSponLo, setMcSponLo] = useState(0);
  const [mcSponHi, setMcSponHi] = useState(2000);
  const [mcRuns, setMcRuns] = useState(1000);
  const [mcResults, setMcResults] = useState(null);
  const [copied, setCopied] = useState(false);

  const amenitiesTotal = useMemo(() => amenityItems.reduce((s, a) => s + Math.max(0, a.cost - a.sponsored), 0), [amenityItems]);
  const amenitiesGross = useMemo(() => amenityItems.reduce((s, a) => s + a.cost, 0), [amenityItems]);
  const paidAttendees = useMemo(() => Math.round(attendance * paidRate / 100), [attendance, paidRate]);

  const calc = useMemo(() => {
    const vatMul = 1 + vatRate / 100;
    let grossTicketRev, avgGross;
    if (ticketMode === "detailed") {
      const total = ebQ + stQ + fnQ;
      const scale = total > 0 ? Math.min(paidAttendees / total, 1) : 0;
      const eQ = Math.round(ebQ * scale), sQ = Math.round(stQ * scale), fQ = Math.max(0, paidAttendees - eQ - sQ);
      grossTicketRev = eQ * ebP + sQ * stP + fQ * fnP;
      avgGross = paidAttendees > 0 ? grossTicketRev / paidAttendees : 0;
    } else {
      avgGross = simpleAvg;
      grossTicketRev = simpleAvg * paidAttendees;
    }
    const netTicketRev = grossTicketRev / vatMul;
    const avgNet = paidAttendees > 0 ? netTicketRev / paidAttendees : 0;
    const hallGross = hallNet * (1 - hallDiscount / 100) * vatMul;
    const kitGross = kitchenReq ? kitchenNet * (1 - kitchenDiscount / 100) * vatMul : 0;
    const venueCost = hallGross + kitGross + security + (depositReturned ? 0 : deposit);
    const venueCash = hallGross + kitGross + security + deposit;
    const effectiveCPH = Math.max(0, cateringPH - cateringSaving);
    const cateringHeads = Math.ceil(attendance * (1 + cateringBuffer / 100));
    const cateringTotal = effectiveCPH * cateringHeads;
    const actualDecor = Math.max(0, decorBudget - decorSpon);
    const baseCost = venueCost + cateringTotal + actualDecor + amenitiesTotal + mainAuction + silentAuction + otherExp;
    const contingency = baseCost * contingencyPct / 100;
    const totalCost = baseCost + (useContingency ? contingency : 0);
    const totalCostWithCont = baseCost + contingency;
    const dinnerDeficit = totalCost - netTicketRev - cashSpon;
    const costPerAttendee = attendance > 0 ? totalCost / attendance : 0;
    const subsidyPerAttendee = attendance > 0 ? dinnerDeficit / attendance : 0;
    const cwSupport = cwFundraising * cwSupportPct / 100;
    const cwAllocCapped = Math.min(cwDinnerAlloc, cwSupport);
    const campaignAdj = dinnerDeficit - cwAllocCapped;
    const cwRemaining = cwSupport - cwAllocCapped - cwOtherCosts;
    const cwDinnerPct = cwSupport > 0 ? cwAllocCapped / cwSupport : 0;
    const dinnerBE = paidAttendees > 0 ? (totalCost - cashSpon) / paidAttendees * vatMul : 0;
    const afterCwBE = paidAttendees > 0 ? Math.max(0, (totalCost - cashSpon - cwAllocCapped) / paidAttendees * vatMul) : 0;
    const preEventCash = venueCash + cateringTotal + actualDecor + amenitiesTotal + mainAuction + silentAuction + otherExp;
    const breakdown = [
      { name: "Catering", value: cateringTotal, color: "#10b981" },
      { name: "Hall Hire", value: hallGross, color: "#3b82f6" },
      { name: "Kitchen", value: kitGross, color: "#6366f1" },
      { name: "Security", value: security, color: "#8b5cf6" },
      { name: "Decor", value: actualDecor, color: "#f59e0b" },
      { name: "Amenities", value: amenitiesTotal, color: "#ec4899" },
      { name: "Auction Items", value: mainAuction + silentAuction, color: "#ef4444" },
      { name: "Other", value: otherExp, color: "#64748b" },
    ].filter(d => d.value > 0);
    if (useContingency && contingency > 0) breakdown.push({ name: "Contingency", value: contingency, color: "#94a3b8" });
    return { grossTicketRev, netTicketRev, avgGross, avgNet, hallGross, kitGross, venueCost, venueCash, effectiveCPH, cateringHeads, cateringTotal, actualDecor, baseCost, contingency, totalCost, totalCostWithCont, dinnerDeficit, costPerAttendee, subsidyPerAttendee, cwSupport, cwAllocCapped, campaignAdj, cwRemaining, cwDinnerPct, dinnerBE, afterCwBE, preEventCash, breakdown };
  }, [attendance, paidRate, paidAttendees, ticketMode, ebP, ebQ, stP, stQ, fnP, fnQ, simpleAvg, hallNet, vatRate, kitchenNet, kitchenReq, security, deposit, depositReturned, cateringPH, cateringBuffer, decorBudget, decorSpon, amenitiesTotal, mainAuction, silentAuction, otherExp, contingencyPct, useContingency, cwFundraising, cwSupportPct, cwDinnerAlloc, cwOtherCosts, cashSpon, hallDiscount, kitchenDiscount, cateringSaving]);

  const beData = useMemo(() => {
    const vatMul = 1 + vatRate / 100;
    const pts = [];
    for (let gp = 10; gp <= 50; gp += 1) {
      const netRev = (gp * paidAttendees) / vatMul;
      pts.push({ price: gp, dinner: Math.round(netRev + cashSpon - calc.totalCost), afterCW: Math.round(netRev + cashSpon - calc.totalCost + calc.cwAllocCapped) });
    }
    return pts;
  }, [paidAttendees, vatRate, cashSpon, calc.totalCost, calc.cwAllocCapped]);

  const cateringSensData = useMemo(() => {
    const pts = [];
    for (let c = 10; c <= 40; c += 1) {
      const heads = Math.ceil(attendance * (1 + cateringBuffer / 100));
      const catCost = Math.max(0, c - cateringSaving) * heads;
      const otherCosts = calc.totalCost - calc.cateringTotal;
      const total = otherCosts + catCost;
      const deficit = total - calc.netTicketRev - cashSpon;
      pts.push({ catering: c, dinner: Math.round(-deficit), afterCW: Math.round(-deficit + calc.cwAllocCapped) });
    }
    return pts;
  }, [attendance, cateringBuffer, cateringSaving, calc, cashSpon]);

  const attSensData = useMemo(() => {
    const vatMul = 1 + vatRate / 100;
    const pts = [];
    for (let a = 250; a <= 400; a += 10) {
      const pa = Math.round(a * paidRate / 100);
      const total2 = ebQ + stQ + fnQ;
      const scale = total2 > 0 ? Math.min(pa / total2, 1) : 0;
      const eQ = Math.round(ebQ * scale), sQ = Math.round(stQ * scale), fQ = Math.max(0, pa - eQ - sQ);
      const grossRev = ticketMode === "detailed" ? eQ * ebP + sQ * stP + fQ * fnP : simpleAvg * pa;
      const netRev = grossRev / vatMul;
      const heads = Math.ceil(a * (1 + cateringBuffer / 100));
      const fixedCosts = calc.venueCost + calc.actualDecor + amenitiesTotal + mainAuction + silentAuction + otherExp;
      const catCost = calc.effectiveCPH * heads;
      const base = fixedCosts + catCost;
      const total = base + (useContingency ? base * contingencyPct / 100 : 0);
      const deficit = total - netRev - cashSpon;
      pts.push({ att: a, deficit: Math.round(-deficit), afterCW: Math.round(-deficit + calc.cwAllocCapped), costPA: safe(total / a, 0) });
    }
    return pts;
  }, [attendance, paidRate, vatRate, ticketMode, ebP, ebQ, stP, stQ, fnP, fnQ, simpleAvg, cateringBuffer, calc, amenitiesTotal, mainAuction, silentAuction, otherExp, useContingency, contingencyPct, cashSpon]);

  const heatmapData = useMemo(() => {
    const vatMul = 1 + vatRate / 100;
    const tickets = [15, 18, 20, 22, 25, 28, 30, 35];
    const caterings = [15, 18, 20, 22, 25, 28, 30, 35];
    const otherCosts = calc.venueCost + calc.actualDecor + amenitiesTotal + mainAuction + silentAuction + otherExp + (useContingency ? (calc.venueCost + calc.actualDecor + amenitiesTotal + mainAuction + silentAuction + otherExp) * contingencyPct / 100 : 0);
    const grid = caterings.map(cp => {
      const row = { catering: cp };
      tickets.forEach(tp => {
        const netRev = (tp * paidAttendees) / vatMul + cashSpon;
        const heads = Math.ceil(attendance * (1 + cateringBuffer / 100));
        const catTotal = Math.max(0, cp - cateringSaving) * heads;
        const base = otherCosts + catTotal;
        const total = base + (useContingency ? catTotal * contingencyPct / 100 : 0);
        row[`t${tp}`] = Math.round(netRev - total + calc.cwAllocCapped);
      });
      return row;
    });
    return { tickets, caterings, grid };
  }, [vatRate, paidAttendees, attendance, cateringBuffer, cateringSaving, calc, amenitiesTotal, mainAuction, silentAuction, otherExp, useContingency, contingencyPct, cashSpon]);

  const tornadoData = useMemo(() => {
    const base = calc.dinnerDeficit;
    const calcD = (type, delta) => {
      const vatMul = 1 + vatRate / 100;
      let att = attendance, cph = cateringPH, tp = calc.avgGross, ven = calc.venueCost, sp = cashSpon, dec = calc.actualDecor;
      if (type === "catering") cph += delta;
      if (type === "attendance") att = Math.max(100, att + delta);
      if (type === "ticket") tp += delta;
      if (type === "venue") ven += delta;
      if (type === "spon") sp = Math.max(0, sp + delta);
      if (type === "decor") dec = Math.max(0, dec + delta);
      const pa = Math.round(att * paidRate / 100);
      const heads = Math.ceil(att * (1 + cateringBuffer / 100));
      const cat = Math.max(0, cph - cateringSaving) * heads;
      const b = ven + cat + dec + amenitiesTotal + mainAuction + silentAuction + otherExp;
      const tot = b + (useContingency ? b * contingencyPct / 100 : 0);
      return tot - (tp * pa) / vatMul - sp;
    };
    return [
      { name: "Catering ±£5/head", lo: calcD("catering", -5) - base, hi: calcD("catering", 5) - base },
      { name: "Attendance ±50", lo: calcD("attendance", -50) - base, hi: calcD("attendance", 50) - base },
      { name: "Ticket Price ±£3", lo: calcD("ticket", 3) - base, hi: calcD("ticket", -3) - base },
      { name: "Venue ±£500", lo: calcD("venue", -500) - base, hi: calcD("venue", 500) - base },
      { name: "Sponsorship ±£1k", lo: calcD("spon", 1000) - base, hi: calcD("spon", -1000) - base },
      { name: "Decor ±£500", lo: calcD("decor", -500) - base, hi: calcD("decor", 500) - base },
    ].sort((a, b) => Math.abs(b.hi - b.lo) - Math.abs(a.hi - a.lo));
  }, [calc, attendance, cateringPH, paidRate, cateringBuffer, cateringSaving, amenitiesTotal, mainAuction, silentAuction, otherExp, useContingency, contingencyPct, cashSpon, vatRate]);

  const highLeverage = useMemo(() => [
    { action: "Reduce catering by £5/head", saving: 5 * calc.cateringHeads, difficulty: "Medium" },
    { action: "Reduce catering by £3/head", saving: 3 * calc.cateringHeads, difficulty: "Medium" },
    { action: "Reduce catering by £1/head", saving: 1 * calc.cateringHeads, difficulty: "Low" },
    { action: "Negotiate hall hire -£500 net", saving: 500 * (1 + vatRate / 100), difficulty: "Medium" },
    { action: "Waive kitchen hire", saving: kitchenReq ? kitchenNet * (1 + vatRate / 100) : 0, difficulty: "Medium" },
    { action: "Secure £1k cash sponsorship", saving: 1000, difficulty: "Medium" },
    { action: "Reduce decor by £500", saving: Math.min(500, calc.actualDecor), difficulty: "Low" },
    { action: "Reduce amenities by £250", saving: Math.min(250, amenitiesTotal), difficulty: "Low" },
    { action: "Free photography (volunteer)", saving: amenityItems.find(a => a.name === "Photography")?.cost || 0, difficulty: "Low" },
    { action: "Skip auction purchases", saving: mainAuction + silentAuction, difficulty: "Low" },
  ].filter(i => i.saving > 0).sort((a, b) => b.saving - a.saving), [calc, vatRate, kitchenNet, kitchenReq, amenitiesTotal, amenityItems, mainAuction, silentAuction]);

  const runMonteCarlo = useCallback(() => {
    const vatMul = 1 + vatRate / 100;
    const results = [];
    for (let i = 0; i < mcRuns; i++) {
      const a = Math.round(mcAttLo + Math.random() * (mcAttHi - mcAttLo));
      const c = mcCatLo + Math.random() * (mcCatHi - mcCatLo);
      const s = mcSponLo + Math.random() * (mcSponHi - mcSponLo);
      const pa = Math.round(a * paidRate / 100);
      const total2 = ebQ + stQ + fnQ;
      const scale = total2 > 0 ? Math.min(pa / total2, 1) : 0;
      const eQ = Math.round(ebQ * scale), sQ = Math.round(stQ * scale), fQ = Math.max(0, pa - eQ - sQ);
      const grossRev = ticketMode === "detailed" ? eQ * ebP + sQ * stP + fQ * fnP : simpleAvg * pa;
      const netRev = grossRev / vatMul;
      const heads = Math.ceil(a * (1 + cateringBuffer / 100));
      const catCost = Math.max(0, c - cateringSaving) * heads;
      const fixedC = calc.venueCost + calc.actualDecor + amenitiesTotal + mainAuction + silentAuction + otherExp;
      const base = fixedC + catCost;
      const total = base + (useContingency ? base * contingencyPct / 100 : 0);
      const deficit = total - netRev - s;
      const afterCW = deficit - calc.cwAllocCapped;
      results.push({ deficit, afterCW, att: a, cat: c, spon: s });
    }
    results.sort((a, b) => a.afterCW - b.afterCW);
    const deficits = results.map(r => r.afterCW);
    const median = deficits[Math.floor(deficits.length / 2)];
    const p10 = deficits[Math.floor(deficits.length * 0.1)];
    const p25 = deficits[Math.floor(deficits.length * 0.25)];
    const p75 = deficits[Math.floor(deficits.length * 0.75)];
    const p90 = deficits[Math.floor(deficits.length * 0.9)];
    const min = deficits[0];
    const max = deficits[deficits.length - 1];
    const withinMax = deficits.filter(d => d <= maxLoss).length / deficits.length;
    const hist = [];
    const bucketSize = 1000;
    const lo = Math.floor(min / bucketSize) * bucketSize;
    const hi = Math.ceil(max / bucketSize) * bucketSize;
    for (let b = lo; b <= hi; b += bucketSize) {
      hist.push({ range: fmt(-b), count: deficits.filter(d => d >= b && d < b + bucketSize).length, deficit: b });
    }
    setMcResults({ median, p10, p25, p75, p90, min, max, withinMax, hist, n: mcRuns });
  }, [mcAttLo, mcAttHi, mcCatLo, mcCatHi, mcSponLo, mcSponHi, mcRuns, paidRate, ebQ, stQ, fnQ, ebP, stP, fnP, ticketMode, simpleAvg, cateringBuffer, cateringSaving, calc, amenitiesTotal, mainAuction, silentAuction, otherExp, useContingency, contingencyPct, vatRate, maxLoss]);

  const applyPreset = (p) => {
    if (p.attendance !== undefined) setAttendance(p.attendance);
    if (p.cateringPH !== undefined) setCateringPH(p.cateringPH);
    if (p.ebP !== undefined) { setEbP(p.ebP); setStP(p.stP); setFnP(p.fnP); }
    if (p.decorBudget !== undefined) setDecorBudget(p.decorBudget);
    if (p.cashSpon !== undefined) setCashSpon(p.cashSpon);
    if (p.maxLoss !== undefined) setMaxLoss(p.maxLoss);
  };

  const saveScenario = () => {
    if (!scenarioName.trim()) return;
    setScenarios(prev => [...prev.slice(-4), {
      name: scenarioName, attendance, cateringPH: calc.effectiveCPH, avgGross: calc.avgGross,
      totalCost: calc.totalCost, netTicketRev: calc.netTicketRev, dinnerDeficit: calc.dinnerDeficit,
      campaignAdj: calc.campaignAdj, costPA: calc.costPerAttendee, subsidyPA: calc.subsidyPerAttendee,
      cashSpon, cwAlloc: calc.cwAllocCapped,
    }]);
    setScenarioName("");
  };

  const copySummary = () => {
    const txt = `Charity Week Auction Dinner 2026 - Scenario Summary
Attendance: ${attendance} / 400
Avg Ticket (gross): ${fmtD(calc.avgGross)} | Net to ISoc: ${fmtD(calc.avgNet)}
Catering: ${fmtD(calc.effectiveCPH)}/head x ${calc.cateringHeads} = ${fmt(calc.cateringTotal)}
Total Dinner Cost: ${fmt(calc.totalCost)}
Net Ticket Revenue: ${fmt(calc.netTicketRev)}
Cash Sponsorship: ${fmt(cashSpon)}
Dinner Deficit: ${fmt(calc.dinnerDeficit)}
CW Support Allocated: ${fmt(calc.cwAllocCapped)}
Campaign-Adjusted Position: ${fmt(-calc.campaignAdj)} ${calc.campaignAdj > 0 ? "(deficit)" : "(funded)"}
Subsidy Per Attendee: ${fmtD(calc.subsidyPerAttendee)}
Cost Per Attendee: ${fmtD(calc.costPerAttendee)}
Max Acceptable Loss: ${fmt(maxLoss)} | Status: ${calc.dinnerDeficit <= maxLoss ? "WITHIN BUDGET" : "OVER BUDGET"}`;
    navigator.clipboard?.writeText(txt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const addAmenity = () => {
    setAmenityItems(prev => [...prev, { id: nextAmenityId, name: "New Item", cost: 0, sponsored: 0 }]);
    setNextAmenityId(n => n + 1);
  };
  const removeAmenity = (id) => setAmenityItems(prev => prev.filter(a => a.id !== id));
  const updateAmenity = (id, field, value) => setAmenityItems(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));

  const withinBudget = calc.dinnerDeficit <= maxLoss;
  const statusColor = withinBudget ? "text-emerald-400" : "text-red-400";
  const statusBg = withinBudget ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30";

  const warnings = useMemo(() => {
    const w = [];
    const catPct = calc.totalCost > 0 ? calc.cateringTotal / calc.totalCost : 0;
    if (catPct > 0.55) w.push({ t: "w", m: `Catering is ${(catPct * 100).toFixed(0)}% of total dinner cost` });
    if (calc.dinnerDeficit > maxLoss) w.push({ t: "e", m: `Dinner deficit is ${fmt(calc.dinnerDeficit - maxLoss)} above your maximum` });
    if (calc.cwDinnerPct > 0.85) w.push({ t: "w", m: `Dinner uses ${(calc.cwDinnerPct * 100).toFixed(0)}% of CW support` });
    if (calc.cwRemaining < 0) w.push({ t: "e", m: `CW support overallocated by ${fmt(Math.abs(calc.cwRemaining))}` });
    if (calc.campaignAdj <= 0 && calc.dinnerDeficit <= maxLoss) w.push({ t: "g", m: "Campaign-adjusted position is positive" });
    return w;
  }, [calc, maxLoss]);

  const renderOverview = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPI label="Dinner Cost" value={fmt(calc.totalCost)} sub={`${fmtD(calc.costPerAttendee)}/person`} />
        <KPI label="Net Ticket Revenue" value={fmt(calc.netTicketRev)} sub={`Gross ${fmt(calc.grossTicketRev)} minus ${fmt(calc.grossTicketRev - calc.netTicketRev)} VAT`} />
        <KPI label="Dinner Deficit" value={fmt(-calc.dinnerDeficit)} color={calc.dinnerDeficit > 0 ? "text-red-400" : "text-emerald-400"} sub={`${fmtD(calc.subsidyPerAttendee)}/person subsidy`} />
        <KPI label="CW Support Allocated" value={fmt(calc.cwAllocCapped)} sub={`${(calc.cwDinnerPct * 100).toFixed(0)}% of ${fmt(calc.cwSupport)} total`} />
        <KPI label="Campaign-Adjusted" value={fmt(-calc.campaignAdj)} color={calc.campaignAdj > 0 ? "text-red-400" : "text-emerald-400"} sub={calc.campaignAdj > 0 ? "Remaining ISoc subsidy" : "Fully funded by CW"} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Avg Ticket (Gross)" value={fmtD(calc.avgGross)} sub={`Net: ${fmtD(calc.avgNet)}`} size="text-xl" />
        <KPI label="Attendance" value={`${attendance}/400`} sub={`${(attendance/400*100).toFixed(0)}% capacity`} size="text-xl" />
        <KPI label="Break-Even (Dinner)" value={fmtD(calc.dinnerBE)} sub="Gross ticket needed" size="text-xl" />
        <KPI label="Break-Even (After CW)" value={fmtD(calc.afterCwBE)} sub="After CW allocation" size="text-xl" />
        <KPI label="Cash Required" value={fmt(calc.preEventCash + deposit)} sub={`Inc. ${fmt(deposit)} refundable deposit`} size="text-xl" />
      </div>
      <div className={`rounded-xl border p-4 flex items-center justify-between ${statusBg}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{withinBudget ? "✓" : "✗"}</span>
          <span className={`font-semibold ${statusColor}`}>
            {withinBudget ? `Within budget - ${fmt(maxLoss - calc.dinnerDeficit)} margin` : `Over budget by ${fmt(calc.dinnerDeficit - maxLoss)}`}
          </span>
          <span className="text-sm text-slate-400 ml-2">(Max loss: {fmt(maxLoss)})</span>
        </div>
        <button onClick={copySummary} className="px-3 py-1.5 rounded-lg text-xs bg-slate-700 text-slate-300 hover:bg-slate-600">{copied ? "Copied!" : "Copy Summary"}</button>
      </div>
      {warnings.length > 0 && <div className="space-y-1">{warnings.map((w, i) => <div key={i} className={`text-sm px-3 py-2 rounded-lg ${w.t === "e" ? "bg-red-500/10 text-red-300" : w.t === "g" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>{w.t === "e" ? "⚠ " : w.t === "g" ? "✓ " : "△ "}{w.m}</div>)}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Quick Controls">
          <Slider label="Attendance" value={attendance} onChange={setAttendance} min={250} max={400} />
          <Slider label="Catering / head" value={cateringPH} onChange={setCateringPH} min={10} max={40} step={0.5} prefix="£" />
          <Slider label="Max Dinner Loss" value={maxLoss} onChange={setMaxLoss} min={0} max={20000} step={500} prefix="£" />
          <Slider label="CW Dinner Allocation" value={cwDinnerAlloc} onChange={setCwDinnerAlloc} min={0} max={Math.round(calc.cwSupport)} step={500} prefix="£" />
        </Card>
        <Card title="Expense Breakdown">
          <div className="space-y-1.5">
            {calc.breakdown.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-slate-400 flex-1">{d.name}</span>
                <span className="text-sm text-white font-medium">{fmt(d.value)}</span>
                <span className="text-xs text-slate-500 w-10 text-right">{(d.value / calc.totalCost * 100).toFixed(0)}%</span>
              </div>
            ))}
            <div className="border-t border-slate-700 pt-1.5 flex justify-between">
              <span className="text-xs font-semibold text-slate-300">Total</span>
              <span className="text-sm font-bold text-white">{fmt(calc.totalCost)}</span>
            </div>
          </div>
        </Card>
        <Card title="High-Leverage Savings">
          <div className="space-y-1.5">
            {highLeverage.slice(0, 7).map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-emerald-400 font-bold w-14 text-right">{fmt(h.saving)}</span>
                <span className="text-slate-300 flex-1">{h.action}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card title="Break-Even Analysis">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={beData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="price" stroke="#94a3b8" tick={{ fontSize: 11 }} label={{ value: "Gross Avg Ticket (£)", position: "bottom", offset: -5, fill: "#94a3b8", fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={v => `${v >= 0 ? "" : "-"}£${Math.abs(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={v => fmt(v)} contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} labelFormatter={v => `£${v} avg ticket`} />
            <Legend />
            <ReferenceLine y={0} stroke="#64748b" strokeDasharray="6 3" label={{ value: "Break-even", fill: "#94a3b8", fontSize: 10 }} />
            <ReferenceLine y={-maxLoss} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `Max loss`, fill: "#ef4444", fontSize: 10 }} />
            <ReferenceLine x={Math.round(calc.avgGross)} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `Current`, fill: "#f59e0b", fontSize: 10, position: "top" }} />
            <Line type="monotone" dataKey="dinner" name="Dinner Only" stroke="#ef4444" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="afterCW" name="After CW Support" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );

  const renderTickets = () => (
    <div className="space-y-4">
      <div className="flex gap-2 mb-2">
        <button onClick={() => setTicketMode("detailed")} className={`px-3 py-1.5 rounded-lg text-sm ${ticketMode === "detailed" ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300"}`}>Detailed Releases</button>
        <button onClick={() => setTicketMode("average")} className={`px-3 py-1.5 rounded-lg text-sm ${ticketMode === "average" ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300"}`}>Average Price</button>
      </div>
      {ticketMode === "detailed" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Ticket Releases">
            <div className="space-y-4">
              {[
                { label: "Early Bird", color: "text-emerald-400", p: ebP, setP: setEbP, q: ebQ, setQ: setEbQ },
                { label: "Standard", color: "text-blue-400", p: stP, setP: setStP, q: stQ, setQ: setStQ },
                { label: "Final Release", color: "text-purple-400", p: fnP, setP: setFnP, q: fnQ, setQ: setFnQ },
              ].map(t => (
                <div key={t.label}>
                  <div className={`text-xs ${t.color} font-semibold mb-1`}>{t.label}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Slider label="Price" value={t.p} onChange={t.setP} min={5} max={50} prefix="£" />
                    <Slider label="Qty" value={t.q} onChange={t.setQ} min={0} max={400} />
                  </div>
                  <div className="text-xs text-slate-500">Gross: {fmt(t.q * t.p)} | Net: {fmt(t.q * t.p / (1 + vatRate/100))}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(PRESETS).map(([name, p]) => (
                <button key={name} onClick={() => { setEbP(p.ebP); setStP(p.stP); setFnP(p.fnP); }} className="px-2 py-1 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600">{name}: £{p.ebP}/£{p.stP}/£{p.fnP}</button>
              ))}
            </div>
          </Card>
          <Card title="Revenue Summary">
            <Slider label="Paid Ticket Rate" value={paidRate} onChange={setPaidRate} min={80} max={100} suffix="%" />
            <div className="bg-slate-900/50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Tickets allocated</span><span>{ebQ + stQ + fnQ}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Paid attendees</span><span>{paidAttendees}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Gross revenue</span><span>{fmt(calc.grossTicketRev)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">VAT deducted</span><span className="text-red-400">-{fmt(calc.grossTicketRev - calc.netTicketRev)}</span></div>
              <div className="flex justify-between border-t border-slate-700 pt-2"><span className="text-slate-300 font-semibold">Net to ISoc</span><span className="text-emerald-400 font-bold">{fmt(calc.netTicketRev)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Avg gross</span><span>{fmtD(calc.avgGross)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Avg net</span><span className="text-emerald-400">{fmtD(calc.avgNet)}</span></div>
            </div>
          </Card>
        </div>
      ) : (
        <Card title="Simple Average Ticket Mode">
          <Slider label="Avg Gross Ticket" value={simpleAvg} onChange={setSimpleAvg} min={10} max={50} prefix="£" />
          <div className="bg-slate-900/50 rounded-lg p-3 mt-2 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Paid attendees</span><span>{paidAttendees}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Gross</span><span>{fmt(calc.grossTicketRev)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Net to ISoc</span><span className="text-emerald-400 font-bold">{fmt(calc.netTicketRev)}</span></div>
          </div>
        </Card>
      )}
      <Card title="Quick Structure Comparison (at current quantities)">
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-slate-400 border-b border-slate-700"><th className="text-left py-1">Structure</th><th className="text-right px-2">Gross</th><th className="text-right px-2">Net</th><th className="text-right px-2">Avg Net</th><th className="text-right px-2">Deficit</th><th className="text-right px-2">After CW</th></tr></thead><tbody>
          {[{n:"£18/£23/£28",e:18,s:23,f:28},{n:"£20/£25/£30",e:20,s:25,f:30},{n:"£22/£26/£30",e:22,s:26,f:30},{n:"£24/£28/£32",e:24,s:28,f:32},{n:"£15/£20/£25",e:15,s:20,f:25}].map(t=>{
            const tot=ebQ+stQ+fnQ;const sc=tot>0?Math.min(paidAttendees/tot,1):0;const eQ=Math.round(ebQ*sc),sQ=Math.round(stQ*sc),fQ=Math.max(0,paidAttendees-eQ-sQ);
            const g=eQ*t.e+sQ*t.s+fQ*t.f;const n2=g/(1+vatRate/100);const def=calc.totalCost-n2-cashSpon;const acw=def-calc.cwAllocCapped;
            return <tr key={t.n} className="border-b border-slate-800 hover:bg-slate-700/30"><td className="py-1.5 text-slate-300 font-medium">{t.n}</td><td className="text-right px-2">{fmt(g)}</td><td className="text-right px-2 text-emerald-400">{fmt(n2)}</td><td className="text-right px-2">{fmtD(safe(n2/paidAttendees))}</td><td className={`text-right px-2 ${def>0?"text-red-400":"text-emerald-400"}`}>{fmt(-def)}</td><td className={`text-right px-2 ${acw>0?"text-red-400":"text-emerald-400"}`}>{fmt(-acw)}</td></tr>;
          })}</tbody></table></div>
      </Card>
    </div>
  );

  const renderCosts = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Venue - Porchester Hall">
          <Slider label="Hall Dry Hire (ex. VAT)" value={hallNet} onChange={setHallNet} min={2000} max={6000} step={50} prefix="£" />
          <div className="text-xs text-slate-500 mb-2">Gross inc. VAT: {fmt(hallNet*(1+vatRate/100))}</div>
          <Toggle label="Kitchen hire required" value={kitchenReq} onChange={setKitchenReq} />
          {kitchenReq && <><Slider label="Kitchen (ex. VAT)" value={kitchenNet} onChange={setKitchenNet} min={0} max={1500} step={50} prefix="£" /><div className="text-xs text-slate-500 mb-2">Gross: {fmt(kitchenNet*(1+vatRate/100))}</div></>}
          <Slider label="Security (inc. VAT)" value={security} onChange={setSecurity} min={0} max={1500} step={10} prefix="£" info="Already VAT-inclusive - do not add VAT" />
          <Slider label="Damage Deposit" value={deposit} onChange={setDeposit} min={0} max={1000} step={50} prefix="£" />
          <Toggle label="Assume deposit returned" value={depositReturned} onChange={setDepositReturned} />
          <div className="bg-slate-900/50 rounded-lg p-3 mt-2 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Venue cost</span><span className="font-semibold">{fmt(calc.venueCost)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Cash needed (inc. deposit)</span><span className="text-amber-400">{fmt(calc.venueCash)}</span></div>
          </div>
        </Card>
        <Card title="Catering">
          <Slider label="Cost Per Head" value={cateringPH} onChange={setCateringPH} min={10} max={40} step={0.5} prefix="£" />
          <Slider label="Buffer" value={cateringBuffer} onChange={setCateringBuffer} min={0} max={20} suffix="%" info={`Ordering for ${calc.cateringHeads} heads`} />
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mt-2 text-sm">
            <div className="text-emerald-300 font-semibold text-lg">{fmtD(calc.effectiveCPH)}/person x {calc.cateringHeads} = {fmt(calc.cateringTotal)}</div>
            <div className="text-emerald-400/70 text-xs mt-1">Every £1/head change = {fmt(calc.cateringHeads)}</div>
          </div>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Decorations">
          <Slider label="Total Budget" value={decorBudget} onChange={setDecorBudget} min={0} max={3000} step={50} prefix="£" />
          <Slider label="Sponsored/Donated" value={decorSpon} onChange={v => setDecorSpon(Math.min(v, decorBudget))} min={0} max={decorBudget} step={50} prefix="£" />
          <div className="text-xs text-emerald-400 mt-1">Actual ISoc cost: {fmt(calc.actualDecor)}</div>
        </Card>
        <Card title="Amenities (Individual Items)">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {amenityItems.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-xs">
                <input type="text" value={a.name} onChange={e => updateAmenity(a.id, "name", e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs" />
                <span className="text-slate-500">£</span>
                <input type="number" value={a.cost} onChange={e => updateAmenity(a.id, "cost", Math.max(0, Number(e.target.value) || 0))} className="w-16 bg-slate-800 border border-slate-700 rounded px-1 py-1 text-white text-xs text-right" />
                <span className="text-slate-500">spon £</span>
                <input type="number" value={a.sponsored} onChange={e => updateAmenity(a.id, "sponsored", clamp(Number(e.target.value) || 0, 0, a.cost))} className="w-16 bg-slate-800 border border-slate-700 rounded px-1 py-1 text-white text-xs text-right" />
                <button onClick={() => removeAmenity(a.id)} className="text-red-400 hover:text-red-300 px-1">✕</button>
              </div>
            ))}
          </div>
          <button onClick={addAmenity} className="mt-2 text-xs text-emerald-400 hover:text-emerald-300">+ Add item</button>
          <div className="bg-slate-900/50 rounded-lg p-2 mt-2 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Gross amenity value</span><span>{fmt(amenitiesGross)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Sponsored</span><span className="text-emerald-400">-{fmt(amenitiesGross - amenitiesTotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-300 font-semibold">Actual cost</span><span className="font-semibold">{fmt(amenitiesTotal)}</span></div>
          </div>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Auction Purchases & Other">
          <Slider label="Main Auction Purchases" value={mainAuction} onChange={setMainAuction} min={0} max={3000} step={50} prefix="£" />
          <Slider label="Silent Auction Purchases" value={silentAuction} onChange={setSilentAuction} min={0} max={1000} step={50} prefix="£" />
          <Slider label="Other Expenses" value={otherExp} onChange={setOtherExp} min={0} max={2000} step={50} prefix="£" />
          <div className="text-xs text-slate-500 mt-1">Auction items purchased for resale at charity auction. Keep separate from charitable proceeds.</div>
        </Card>
        <Card title="Contingency & Sponsorship">
          <Slider label="Contingency" value={contingencyPct} onChange={setContingencyPct} min={0} max={15} step={0.5} suffix="%" />
          <Toggle label="Include contingency in projected spend" value={useContingency} onChange={setUseContingency} />
          <div className="text-xs text-slate-500 mb-3">Contingency: {fmt(calc.contingency)} | Max budget: {fmt(calc.totalCostWithCont)}</div>
          <Slider label="Cash Sponsorship" value={cashSpon} onChange={setCashSpon} min={0} max={5000} step={100} prefix="£" />
          <Slider label="In-Kind Value" value={inKindSpon} onChange={setInKindSpon} min={0} max={5000} step={100} prefix="£" info="Factor into Sponsored fields above to avoid double-counting" />
        </Card>
      </div>
      <Card title="Negotiation Simulator">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><Slider label="Hall Discount" value={hallDiscount} onChange={setHallDiscount} min={0} max={30} suffix="%" /><div className="text-xs text-emerald-400">Saves {fmt(hallNet*hallDiscount/100*(1+vatRate/100))}</div></div>
          <div><Slider label="Kitchen Discount" value={kitchenDiscount} onChange={setKitchenDiscount} min={0} max={100} suffix="%" /><div className="text-xs text-emerald-400">Saves {fmt(kitchenNet*kitchenDiscount/100*(1+vatRate/100))}</div></div>
          <div><Slider label="Catering Saving/Head" value={cateringSaving} onChange={setCateringSaving} min={0} max={10} step={0.5} prefix="£" /><div className="text-xs text-emerald-400">Saves {fmt(cateringSaving*calc.cateringHeads)}</div></div>
        </div>
        <div className="mt-3 text-sm text-slate-400">Total negotiation savings: <span className="text-emerald-400 font-semibold">{fmt(hallNet*hallDiscount/100*(1+vatRate/100)+kitchenNet*kitchenDiscount/100*(1+vatRate/100)+cateringSaving*calc.cateringHeads)}</span></div>
      </Card>
    </div>
  );

  const renderAnalysis = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Catering Sensitivity">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={cateringSensData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="catering" stroke="#94a3b8" tick={{ fontSize: 11 }} label={{ value: "£/head", position: "bottom", offset: -5, fill: "#94a3b8", fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={v => `${v >= 0 ? "" : "-"}£${Math.abs(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt(v)} contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
              <Legend />
              <ReferenceLine y={0} stroke="#64748b" strokeDasharray="6 3" />
              <ReferenceLine y={-maxLoss} stroke="#ef4444" strokeDasharray="4 4" />
              <ReferenceLine x={cateringPH} stroke="#f59e0b" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="dinner" name="Dinner" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="afterCW" name="After CW" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Attendance Sensitivity">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={attSensData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="att" stroke="#94a3b8" tick={{ fontSize: 11 }} label={{ value: "Attendees", position: "bottom", offset: -5, fill: "#94a3b8", fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={v => `${v >= 0 ? "" : "-"}£${Math.abs(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt(v)} contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
              <Legend />
              <ReferenceLine y={0} stroke="#64748b" strokeDasharray="6 3" />
              <ReferenceLine y={-maxLoss} stroke="#ef4444" strokeDasharray="4 4" />
              <ReferenceLine x={attendance} stroke="#f59e0b" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="deficit" name="Dinner" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="afterCW" name="After CW" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title="Ticket Price x Catering Heatmap - Campaign-Adjusted Position">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="p-1.5 text-slate-400 text-left">Cat \ Ticket</th>
                {heatmapData.tickets.map(t => <th key={t} className="p-1.5 text-slate-400 text-center">£{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {heatmapData.grid.map(row => (
                <tr key={row.catering}>
                  <td className="p-1.5 text-slate-300 font-medium">£{row.catering}</td>
                  {heatmapData.tickets.map(t => {
                    const v = row[`t${t}`];
                    const bg = v >= 0 ? "bg-emerald-600/40" : v >= -maxLoss ? "bg-amber-600/30" : "bg-red-600/40";
                    return <td key={t} className={`p-1.5 text-center font-medium ${bg}`}>{fmt(v)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-600/40"/>Surplus</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-600/30"/>Within max loss</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-600/40"/>Over max loss</span>
        </div>
      </Card>
      <Card title="Sensitivity Tornado - Impact on Dinner Deficit">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={tornadoData} layout="vertical" margin={{ left: 110 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={v=>fmt(v)} />
            <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10 }} width={105} />
            <Tooltip formatter={v=>fmt(v)} contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
            <ReferenceLine x={0} stroke="#64748b" />
            <Bar dataKey="lo" name="Saves" fill="#10b981" />
            <Bar dataKey="hi" name="Costs" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Reverse Calculators">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
            <div className="text-slate-300 font-medium">To keep dinner loss below {fmt(maxLoss)}:</div>
            <div className="flex justify-between text-slate-400"><span>Max catering/head</span><span className="text-emerald-400 font-medium">{calc.cateringHeads>0?fmtD((maxLoss+calc.netTicketRev+cashSpon-(calc.totalCost-calc.cateringTotal))/calc.cateringHeads+cateringSaving):"N/A"}</span></div>
            <div className="flex justify-between text-slate-400"><span>Required avg gross ticket</span><span className="text-emerald-400 font-medium">{paidAttendees>0?fmtD((calc.totalCost-cashSpon-maxLoss)/paidAttendees*(1+vatRate/100)):"N/A"}</span></div>
            <div className="flex justify-between text-slate-400"><span>Required sponsorship</span><span className="text-emerald-400 font-medium">{fmt(Math.max(0,calc.totalCost-calc.netTicketRev-maxLoss))}</span></div>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
            <div className="text-slate-300 font-medium">To break even after CW:</div>
            <div className="flex justify-between text-slate-400"><span>Required avg gross ticket</span><span className="text-emerald-400 font-medium">{fmtD(calc.afterCwBE)}</span></div>
            <div className="flex justify-between text-slate-400"><span>Or required CW allocation</span><span className="text-emerald-400 font-medium">{fmt(Math.max(0,calc.dinnerDeficit))}</span></div>
            <div className="text-slate-300 font-medium mt-3">To spend £30/head catering:</div>
            <div className="flex justify-between text-slate-400"><span>Additional cost vs current</span><span className="text-red-400 font-medium">{fmt((30-calc.effectiveCPH)*calc.cateringHeads)}</span></div>
          </div>
        </div>
      </Card>
      <Card title="Cost Per Attendee Breakdown">
        <div className="space-y-1.5">
          {calc.breakdown.map(d => {
            const ph = safe(d.value / attendance);
            const pct2 = safe(d.value / calc.totalCost * 100);
            return (
              <div key={d.name} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-20 shrink-0">{d.name}</span>
                <div className="flex-1 bg-slate-700 rounded-full h-5 overflow-hidden">
                  <div className="h-full rounded-full flex items-center px-2 text-xs text-white font-medium" style={{ width: `${Math.max(3, Math.min(100, pct2))}%`, backgroundColor: d.color }}>{fmtD(ph)}</div>
                </div>
                <span className="text-xs text-slate-500 w-10 text-right">{pct2.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
        <div className="border-t border-slate-700 pt-2 mt-2 flex gap-6 text-sm">
          <span className="text-slate-400">Total: <span className="text-white font-bold">{fmtD(calc.costPerAttendee)}</span></span>
          <span className="text-slate-400">Avg ticket (net): <span className="text-emerald-400">{fmtD(calc.avgNet)}</span></span>
          <span className="text-slate-400">Subsidy: <span className="text-red-400">{fmtD(calc.subsidyPerAttendee)}</span></span>
        </div>
      </Card>
    </div>
  );

  const renderScenarios = () => (
    <div className="space-y-4">
      <Card title="Preset Scenarios">
        <div className="flex flex-wrap gap-2">{Object.entries(SCENARIO_PRESETS).map(([n,p])=>(<button key={n} onClick={()=>applyPreset(p)} className="px-3 py-1.5 rounded-lg text-sm bg-slate-700 text-slate-300 hover:bg-emerald-600 hover:text-white transition-colors">{n}</button>))}</div>
      </Card>
      <Card title="Save Current">
        <div className="flex gap-2">
          <input type="text" value={scenarioName} onChange={e=>setScenarioName(e.target.value)} placeholder="Name this scenario..." className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" onKeyDown={e=>e.key==="Enter"&&saveScenario()} />
          <button onClick={saveScenario} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-500">Save</button>
        </div>
      </Card>
      {scenarios.length>0&&(<Card title="Comparison">
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-slate-400 border-b border-slate-700"><th className="text-left py-2 pr-2">Metric</th>{scenarios.map((s,i)=><th key={i} className="text-right px-2 min-w-24">{s.name}</th>)}</tr></thead><tbody>
          {[{l:"Attendance",k:"attendance"},{l:"Catering/head",k:"cateringPH",f:v=>fmtD(v)},{l:"Avg Ticket",k:"avgGross",f:v=>fmtD(v)},{l:"Dinner Cost",k:"totalCost",f:v=>fmt(v)},{l:"Net Ticket Rev",k:"netTicketRev",f:v=>fmt(v)},{l:"Dinner Deficit",k:"dinnerDeficit",f:v=>fmt(-v),c:v=>v>0?"text-red-400":"text-emerald-400"},{l:"CW Allocated",k:"cwAlloc",f:v=>fmt(v)},{l:"Campaign-Adj",k:"campaignAdj",f:v=>fmt(-v),c:v=>v>0?"text-red-400":"text-emerald-400"},{l:"Subsidy/person",k:"subsidyPA",f:v=>fmtD(v)}].map(r=>(<tr key={r.l} className="border-b border-slate-800"><td className="py-1.5 pr-2 text-slate-400">{r.l}</td>{scenarios.map((s,i)=>(<td key={i} className={`text-right px-2 ${r.c?r.c(s[r.k]):"text-white"}`}>{r.f?r.f(s[r.k]):s[r.k]}</td>))}</tr>))}
        </tbody></table></div>
        <button onClick={()=>setScenarios([])} className="mt-2 text-xs text-slate-500 hover:text-red-400">Clear all</button>
      </Card>)}
      <Card title="Current Summary">
        <div className="bg-slate-900/50 rounded-lg p-4 space-y-1 text-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {[["Attendance",`${attendance}/400`],["Catering",`${fmtD(calc.effectiveCPH)}/head`],["Avg ticket (gross)",fmtD(calc.avgGross)],["Avg ticket (net)",fmtD(calc.avgNet)],["Dinner cost",fmt(calc.totalCost)],["Net ticket rev",fmt(calc.netTicketRev)],["Cash sponsorship",fmt(cashSpon)],["CW allocated",fmt(calc.cwAllocCapped)]].map(([l,v])=><div key={l} className="flex justify-between"><span className="text-slate-400">{l}</span><span>{v}</span></div>)}
          </div>
          <div className={`mt-3 p-2 rounded-lg text-center font-semibold border ${statusBg} ${statusColor}`}>
            Dinner deficit: {fmt(-calc.dinnerDeficit)} | After CW: {fmt(-calc.campaignAdj)} | {withinBudget?`✓ Within ${fmt(maxLoss)} limit`:`✗ Over by ${fmt(calc.dinnerDeficit-maxLoss)}`}
          </div>
        </div>
      </Card>
    </div>
  );

  const renderCW = () => {
    const cwData=[];for(let f=20000;f<=100000;f+=5000){const sup=f*cwSupportPct/100;cwData.push({f:f/1000,support:sup,dinner:Math.min(cwDinnerAlloc,sup),remain:Math.max(0,sup-Math.min(cwDinnerAlloc,sup)-cwOtherCosts)});}
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="CW Fundraising" value={fmt(cwFundraising)} />
          <KPI label="Total CW Support" value={fmt(calc.cwSupport)} sub={`${cwSupportPct}% of fundraising`} />
          <KPI label="Dinner Allocation" value={fmt(calc.cwAllocCapped)} sub={`${(calc.cwDinnerPct*100).toFixed(0)}% of support`} />
          <KPI label="Remaining for Other CW" value={fmt(calc.cwRemaining)} color={calc.cwRemaining>=0?"text-emerald-400":"text-red-400"} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Controls">
            <Slider label="CW Fundraising" value={cwFundraising} onChange={setCwFundraising} min={20000} max={100000} step={1000} prefix="£" />
            <Slider label="Support Rate" value={cwSupportPct} onChange={setCwSupportPct} min={10} max={30} suffix="%" />
            <Slider label="Initial Support" value={cwInitial} onChange={setCwInitial} min={0} max={20000} step={500} prefix="£" />
            <Slider label="Dinner Allocation" value={cwDinnerAlloc} onChange={setCwDinnerAlloc} min={0} max={Math.round(calc.cwSupport)} step={500} prefix="£" />
            <Slider label="Other CW Costs" value={cwOtherCosts} onChange={setCwOtherCosts} min={0} max={10000} step={250} prefix="£" />
          </Card>
          <Card title="Support vs Fundraising">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={cwData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="f" stroke="#94a3b8" tick={{fontSize:11}} label={{value:"Fundraising (£k)",position:"bottom",offset:-5,fill:"#94a3b8",fontSize:11}} />
                <YAxis stroke="#94a3b8" tick={{fontSize:11}} tickFormatter={v=>`£${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v=>fmt(v)} contentStyle={{backgroundColor:"#1e293b",border:"1px solid #334155",borderRadius:8}} />
                <Legend />
                <ReferenceLine x={cwFundraising/1000} stroke="#f59e0b" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="support" name="Total Support" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="dinner" name="Dinner Alloc" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="remain" name="Remaining" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
        <Card title="Cash Flow Overview">
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-slate-400 border-b border-slate-700 text-xs"><th className="text-left py-2">Timing</th><th className="text-right">Outflow</th><th className="text-right">Inflow</th><th className="text-right">Notes</th></tr></thead><tbody className="text-slate-300">
            {[
              ["Venue deposit (est.)",fmt(calc.hallGross/2),"","50% estimate"],
              ["Damage deposit",fmt(deposit),"","Refundable"],
              ["CW initial advance","",fmt(cwInitial),""],
              ["Early Bird tickets (net)","",fmt(ebQ*ebP/(1+vatRate/100)),""],
              ["Caterer deposit (est.)",fmt(calc.cateringTotal/2),"","50% estimate"],
              ["Standard tickets (net)","",fmt(stQ*stP/(1+vatRate/100)),""],
              ["Decor + amenities",fmt(calc.actualDecor+amenitiesTotal),"",""],
              ["Final tickets (net)","",fmt(fnQ*fnP/(1+vatRate/100)),""],
              ["Venue balance + security",fmt(calc.hallGross/2+(kitchenReq?calc.kitGross:0)+security),"",""],
              ["Catering balance",fmt(calc.cateringTotal/2),"",""],
              ["Deposit return","",depositReturned?fmt(deposit):"£0",depositReturned?"Expected":"Not assumed"],
              ["Cash sponsorship","",fmt(cashSpon),""],
              ["Later CW support","",fmt(Math.max(0,calc.cwAllocCapped-cwInitial)),"Post-CW"],
            ].map(([t,out,inc,n],i)=><tr key={i} className="border-b border-slate-800"><td className="py-1.5">{t}</td><td className="text-right text-red-400">{out}</td><td className="text-right text-emerald-400">{inc}</td><td className="text-right text-xs text-slate-500">{n}</td></tr>)}
          </tbody></table></div>
          <div className="mt-3 bg-slate-900/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Max pre-event cash</span><span className="text-amber-400 font-semibold">{fmt(calc.preEventCash+deposit)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Final ISoc subsidy</span><span className={`font-semibold ${calc.campaignAdj>0?"text-red-400":"text-emerald-400"}`}>{fmt(Math.max(0,calc.campaignAdj))}</span></div>
          </div>
        </Card>
      </div>
    );
  };

  const renderMC = () => (
    <div className="space-y-4">
      <Card title="Monte Carlo Uncertainty Simulation">
        <p className="text-sm text-slate-400 mb-4">Set ranges for uncertain variables. The simulation runs many random combinations to show the likely range of outcomes.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-slate-400 font-medium mb-2">Attendance Range</div>
            <Slider label="Low" value={mcAttLo} onChange={setMcAttLo} min={200} max={400} />
            <Slider label="High" value={mcAttHi} onChange={setMcAttHi} min={200} max={400} />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium mb-2">Catering Range (£/head)</div>
            <Slider label="Low" value={mcCatLo} onChange={setMcCatLo} min={10} max={40} prefix="£" />
            <Slider label="High" value={mcCatHi} onChange={setMcCatHi} min={10} max={40} prefix="£" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium mb-2">Sponsorship Range</div>
            <Slider label="Low" value={mcSponLo} onChange={setMcSponLo} min={0} max={5000} step={100} prefix="£" />
            <Slider label="High" value={mcSponHi} onChange={setMcSponHi} min={0} max={5000} step={100} prefix="£" />
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <Slider label="Simulations" value={mcRuns} onChange={setMcRuns} min={100} max={5000} step={100} />
          <button onClick={runMonteCarlo} className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 whitespace-nowrap">Run Simulation</button>
        </div>
      </Card>
      {mcResults && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="Median Position" value={fmt(-mcResults.median)} color={mcResults.median>0?"text-red-400":"text-emerald-400"} sub="After CW support" />
            <KPI label="Best Case (P10)" value={fmt(-mcResults.p10)} color={mcResults.p10>0?"text-red-400":"text-emerald-400"} />
            <KPI label="Worst Case (P90)" value={fmt(-mcResults.p90)} color={mcResults.p90>0?"text-red-400":"text-emerald-400"} />
            <KPI label={`P(within ${fmt(maxLoss)})`} value={`${(mcResults.withinMax*100).toFixed(0)}%`} color={mcResults.withinMax>0.7?"text-emerald-400":"text-red-400"} sub={`of ${mcResults.n} simulations`} />
          </div>
          <Card title="Distribution of Outcomes (Campaign-Adjusted)">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={mcResults.hist}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="range" stroke="#94a3b8" tick={{fontSize:10}} angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="#94a3b8" tick={{fontSize:11}} />
                <Tooltip contentStyle={{backgroundColor:"#1e293b",border:"1px solid #334155",borderRadius:8}} />
                <Bar dataKey="count" name="Simulations">{mcResults.hist.map((d,i)=><Cell key={i} fill={d.deficit<=0?"#10b981":d.deficit<=maxLoss?"#f59e0b":"#ef4444"}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"/>Surplus</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500"/>Within limit</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500"/>Over limit</span>
            </div>
          </Card>
          <Card title="Summary Statistics">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[["Best (min)",mcResults.min],["P25",mcResults.p25],["Median",mcResults.median],["P75",mcResults.p75],["P90 (bad)",mcResults.p90],["Worst (max)",mcResults.max]].map(([l,v])=>(
                <div key={l} className="flex justify-between"><span className="text-slate-400">{l}</span><span className={`font-medium ${v>0?"text-red-400":"text-emerald-400"}`}>{fmt(-v)}</span></div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="bg-slate-800/80 border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 md:px-4">
          <div className="flex items-center justify-between py-2.5">
            <div>
              <h1 className="text-base md:text-lg font-bold text-white tracking-tight">CW Auction Dinner 2026</h1>
              <p className="text-xs text-slate-400 hidden md:block">Imperial College ISoc Financial Simulator</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="hidden md:block text-slate-400">Deficit: <span className={calc.dinnerDeficit>0?"text-red-400":"text-emerald-400"}>{fmt(-calc.dinnerDeficit)}</span></div>
              <div className="hidden md:block text-slate-400">After CW: <span className={calc.campaignAdj>0?"text-red-400":"text-emerald-400"}>{fmt(-calc.campaignAdj)}</span></div>
              <button onClick={copySummary} className="px-2 py-1 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 hidden md:block">{copied?"✓":"Copy"}</button>
            </div>
          </div>
          <div className="flex gap-0.5 -mb-px overflow-x-auto scrollbar-hide">
            {TABS.map((t,i)=>(<button key={t} onClick={()=>setTab(i)} className={`px-3 py-2 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab===i?"border-emerald-500 text-emerald-400":"border-transparent text-slate-400 hover:text-slate-200"}`}>{t}</button>))}
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-3 md:px-4 py-4">
        {tab===0&&renderOverview()}
        {tab===1&&renderTickets()}
        {tab===2&&renderCosts()}
        {tab===3&&renderAnalysis()}
        {tab===4&&renderScenarios()}
        {tab===5&&renderCW()}
        {tab===6&&renderMC()}
      </div>
    </div>
  );
}

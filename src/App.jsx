import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Campaign Storyboarder — single‑file React app
 * Diego: maps multi‑concept campaigns by market, enforces annual narrative cohesion,
 * and exports a clean one‑pager for execs.
 *
 * Added now:
 * - Example ATPM 5 Tribes (assign per placement, manage catalogue)
 * - Quarterly Storyboard view (continuity by Q, asset readiness)
 * - Campaign Asset Checklist per placement with completion meter
 * - Inline self‑tests (see devtools console) to validate core logic
 *
 * Notes
 * - Tailwind classes used for styling.
 * - No external UI libs so it runs in canvas.
 * - Data persists in localStorage.
 * - Print to PDF for the one‑pager (browser print).
 */

// ---------- Utilities ----------
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function uid(prefix = "id") { return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`; }

function classNames(...xs) { return xs.filter(Boolean).join(" "); }

function quarterOf(monthIndex) { return Math.floor(monthIndex / 3) + 1; }

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

// Colour seeds for concepts
const SEED_COLOURS = [
  "#2563eb", "#0ea5e9", "#10b981", "#84cc16", "#f59e0b",
  "#ef4444", "#a855f7", "#f43f5e", "#06b6d4", "#eab308"
];

// ---------- Types (JSDoc for intellisense) ----------
/** @typedef {{ id:string, name:string, role:"Hero"|"Support", tags:string[], color:string }} Concept */
/** @typedef {{ id:string, name:string, region?:string }} Market */
/** @typedef {{ conceptId?:string, notes?:string, channels?:string[], budget?:number, tribes?:string[], assets?:Record<string, boolean> }} MonthlyPlacement */
/** @typedef {{ [monthIndex:number]: MonthlyPlacement }} MarketPlan */
/** @typedef {{ [marketId:string]: MarketPlan }} Plan */
/** @typedef {{ id:string, name:string, description:string, triggers:string[], channels:string[] }} Tribe */

// ---------- Asset Catalogue ----------
const ASSET_CATALOG = [
  "Key Visual",
  "30s Master Video",
  "15s Cutdown",
  "6s Bumper",
  "Square + Story Set",
  "Landing Page",
  "Email (Campaign)",
  "CRM Journey",
  "PR Note",
  "Influencer Brief",
  "Display Set",
  "Search Copy",
  "UGC Prompt",
  "Measurement Plan",
  "Legal/Brand Approvals",
];

// ---------- Defaults ----------
const DEFAULT_TRIBES = /** @type {Tribe[]} */ ([
  {
    id: uid("t"),
    name: "Epicurean Couples",
    description: "Food & mixology‑driven duos seeking adults‑only indulgence and chef‑led moments.",
    triggers: ["Chef’s table", "premium spirits", "limited menus"],
    channels: ["Meta", "IG Reels", "PR food media"],
  },
  {
    id: uid("t"),
    name: "Wellness Aesthetes",
    description: "Mindful travellers who collect rituals: sunrise yoga, spa journeys, breathwork on the beach.",
    triggers: ["sunrise rituals", "spa circuits", "sound baths"],
    channels: ["IG", "YouTube", "Email"],
  },
  {
    id: uid("t"),
    name: "Design Lovers & Art Seekers",
    description: "Architecture, contemporary art and photogenic spaces; IG‑forward storytellers.",
    triggers: ["gallery nights", "artist residencies", "design tours"],
    channels: ["IG", "PR design media", "Creators"],
  },
  {
    id: uid("t"),
    name: "Celebration Creators",
    description: "Anniversaries, engagements, milestone trips; small adult groups with premium expectations.",
    triggers: ["bespoke moments", "private dining", "surprise reveals"],
    channels: ["Search (intent)", "Meta", "Concierge/CRM"],
  },
  {
    id: uid("t"),
    name: "Work‑from‑Paradise Execs",
    description: "Bleisure professionals who want quiet luxury, strong Wi‑Fi, and recovery rituals.",
    triggers: ["late checkout", "focus zones", "recovery spa"],
    channels: ["LinkedIn", "Search", "Email"],
  },
]);

const DEFAULT_STATE = {
  year: new Date().getFullYear(),
  northStar: "Togetherness that feels effortless.",
  pillars: ["Hospitalidad hecha a mano", "Servicio adictivo", "Tecnología envolvente", "Conciencia ecosocial"],
  guardrails: ["Always premium, never tacky", "Clarity over cleverness", "Sustainable by default"],
  concepts: /** @type {Concept[]} */ ([
    { id: uid("c"), name: "Love the Long Weekend", role: "Hero", tags: ["short breaks", "romance"], color: SEED_COLOURS[0] },
    { id: uid("c"), name: "Sunrise Rituals", role: "Support", tags: ["wellness", "mindfulness"], color: SEED_COLOURS[6] },
    { id: uid("c"), name: "Culinary Passport", role: "Hero", tags: ["food", "mixology"], color: SEED_COLOURS[4] },
  ]),
  tribes: DEFAULT_TRIBES,
  markets: /** @type {Market[]} */ ([
    { id: uid("m"), name: "Mexico", region: "MX" },
    { id: uid("m"), name: "United States", region: "US" },
    { id: uid("m"), name: "Canada", region: "CA" },
  ]),
  plan: /** @type {Plan} */ ({}),
  cohesionRules: {
    maxHeroConceptsPerMarket: 4,
    minRepeatsPerHero: 3,
    minMonthsPlanned: 10,
    maxTotalConceptsPerMarket: 8,
  },
};

const LS_KEY = "campaign_storyboarder_v2"; // storage key

// ---------- Tiny UI components ----------
function Section({ title, children, actions }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <div className="flex gap-2">{actions}</div>
      </div>
      <div className="bg-white/5 rounded-2xl p-4 border border-white/10 shadow-sm">{children}</div>
    </div>
  );
}

function Pill({ children, tone = "info" }) {
  const tones = {
    info: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    good: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    warn: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    bad: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    neutral: "bg-white/10 text-white/80 border-white/20",
  };
  return <span className={classNames("px-2.5 py-1 rounded-full text-xs border", tones[tone])}>{children}</span>;
}

function IconButton({ label, onClick }) {
  return (
    <button onClick={onClick} className="px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition text-sm">
      {label}
    </button>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl bg-black/20 border border-white/15 outline-none focus:ring-2 focus:ring-sky-500"
    />
  );
}

function NumberInput({ value, onChange, placeholder, min = 0 }) {
  return (
    <input
      type="number"
      min={min}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl bg-black/20 border border-white/15 outline-none focus:ring-2 focus:ring-sky-500"
    />
  );
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      className="w-full px-3 py-2 rounded-xl bg-black/20 border border-white/15 outline-none focus:ring-2 focus:ring-sky-500"
    >
      <option value="">{placeholder ?? "Select"}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-neutral-900 border border-white/10 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20" onClick={onClose}>Close</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

const Checkbox = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 text-sm">
    <input type="checkbox" className="accent-sky-500" checked={!!checked} onChange={(e)=> onChange(e.target.checked)} />
    <span>{label}</span>
  </label>
);

// ---------- Main App ----------
export default function App() {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(LS_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_STATE;
  });

  // Persist to storage
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [state]);

  // Listen for synthetic "storage" events triggered by helpers and refresh state
  useEffect(() => {
    const fn = () => {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) setState(JSON.parse(saved));
    };
    window.addEventListener("storage", fn);
    return () => window.removeEventListener("storage", fn);
  }, []);

  const [activeTab, setActiveTab] = useState("plan"); // plan | cohesion | export | storyboard | settings
  const [selectedMarketId, setSelectedMarketId] = useState(state.markets[0]?.id);
  const [editingCell, setEditingCell] = useState(null);
  const [isConceptModal, setIsConceptModal] = useState(false);
  const [isMarketModal, setIsMarketModal] = useState(false);
  const [isTribeModal, setIsTribeModal] = useState(false);

  const exportRef = useRef(null);

  // Ensure plan structure exists for each market
  useEffect(() => {
    setState((prev) => {
      const plan = { ...prev.plan };
      prev.markets.forEach((m) => { if (!plan[m.id]) plan[m.id] = {}; });
      return { ...prev, plan };
    });
  }, []);

  const selectedMarket = state.markets.find((m) => m.id === selectedMarketId) || state.markets[0];

  // ---------- Mutators ----------
  function upsertPlacement(marketId, month, patch) {
    setState((prev) => {
      const plan = { ...prev.plan };
      const mp = { ...(plan[marketId] || {}) };
      const current = { ...(mp[month] || {}) };
      mp[month] = { ...current, ...patch };
      plan[marketId] = mp;
      return { ...prev, plan };
    });
  }

  function addConcept(newConcept) {
    const c = { ...newConcept, id: uid("c") };
    setState((prev) => ({ ...prev, concepts: [...prev.concepts, c] }));
  }

  function addMarket(name, region) {
    const m = { id: uid("m"), name, region };
    setState((prev) => ({ ...prev, markets: [...prev.markets, m] }));
    setSelectedMarketId(m.id);
  }

  function removeConcept(id) {
    setState((prev) => ({ ...prev, concepts: prev.concepts.filter((c) => c.id !== id) }));
  }

  function addTribe(t) {
    const nt = { ...t, id: uid("t") };
    setState((prev) => ({ ...prev, tribes: [...prev.tribes, nt] }));
  }

  // ---------- Cohesion analysis ----------
  const cohesion = useMemo(() => analyseCohesion(state), [state]);

  // ---------- Rendering ----------
  return (
    <div className="min-h-screen text-white bg-gradient-to-b from-neutral-900 to-neutral-950">
      <style>{`
        @media print {
          body { background: white; }
          #appShell { display: none; }
          #onePager { display: block !important; }
        }
      `}</style>

      <header className="sticky top-0 z-40 backdrop-blur bg-neutral-900/70 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="text-2xl font-bold tracking-tight">Campaign Storyboarder</div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <label className="text-sm text-white/70">Year</label>
              <input
                type="number"
                value={state.year}
                onChange={(e) => setState({ ...state, year: Number(e.target.value) })}
                className="w-24 px-3 py-1.5 rounded-xl bg-black/30 border border-white/15"
              />
            </div>
            <nav className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
              {[
                { id: "plan", label: "Plan" },
                { id: "cohesion", label: "Cohesion" },
                { id: "storyboard", label: "Storyboard" },
                { id: "export", label: "One‑Pager" },
                { id: "settings", label: "Settings" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={classNames(
                    "px-3 py-1.5 rounded-lg text-sm",
                    activeTab === t.id ? "bg-white/20" : "hover:bg-white/10"
                  )}
                >{t.label}</button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main id="appShell" className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "plan" && (
          <PlanTab
            state={state}
            selectedMarketId={selectedMarket?.id}
            onSelectMarket={setSelectedMarketId}
            onEditCell={(payload) => setEditingCell(payload)}
            onOpenConcepts={() => setIsConceptModal(true)}
            onOpenMarkets={() => setIsMarketModal(true)}
            onOpenTribes={() => setIsTribeModal(true)}
          />
        )}

        {activeTab === "cohesion" && (
          <CohesionTab state={state} cohesion={cohesion} />
        )}

        {activeTab === "storyboard" && (
          <StoryboardTab state={state} marketId={selectedMarket?.id} setMarketId={setSelectedMarketId} />
        )}

        {activeTab === "export" && (
          <ExportTab
            state={state}
            cohesion={cohesion}
            marketId={selectedMarket?.id}
            setMarketId={setSelectedMarketId}
            exportRef={exportRef}
          />
        )}

        {activeTab === "settings" && (
          <SettingsTab state={state} setState={setState} />
        )}
      </main>

      {/* ---- Modals ---- */}
      <Modal
        open={!!editingCell}
        title={`Edit ${selectedMarket?.name} — ${MONTHS[editingCell?.month ?? 0]} ${state.year}`}
        onClose={() => setEditingCell(null)}
      >
        {editingCell && (
          <EditCellForm
            state={state}
            cell={editingCell}
            onChange={(patch) => upsertPlacement(editingCell.marketId, editingCell.month, patch)}
            onRemove={() => { upsertPlacement(editingCell.marketId, editingCell.month, { conceptId: undefined, notes: undefined, channels: [], budget: undefined, tribes: [], assets: {} }); setEditingCell(null); }}
          />
        )}
      </Modal>

      <Modal open={isConceptModal} title="Concept Library" onClose={() => setIsConceptModal(false)}>
        <ConceptsManager concepts={state.concepts} onAdd={addConcept} onRemove={removeConcept} />
      </Modal>

      <Modal open={isMarketModal} title="Markets" onClose={() => setIsMarketModal(false)}>
        <MarketsManager markets={state.markets} onAdd={addMarket} />
      </Modal>

      <Modal open={isTribeModal} title="ATPM Tribes (Examples)" onClose={() => setIsTribeModal(false)}>
        <TribesManager tribes={state.tribes} onAdd={addTribe} />
      </Modal>

      {/* Hidden One-Pager for print only; live preview exists in ExportTab */}
      <div id="onePager" className="hidden">
        <OnePager state={state} cohesion={cohesion} marketId={selectedMarket?.id} ref={exportRef} />
      </div>
    </div>
  );
}

// ---------- Tabs ----------
function PlanTab({ state, selectedMarketId, onSelectMarket, onEditCell, onOpenConcepts, onOpenMarkets, onOpenTribes }) {
  const selectedMarket = state.markets.find((m) => m.id === selectedMarketId) || state.markets[0];

  return (
    <>
      <Section
        title="Annual Narrative"
        actions={
          <>
            <IconButton label="Concepts" onClick={onOpenConcepts} />
            <IconButton label="Markets" onClick={onOpenMarkets} />
            <IconButton label="Tribes" onClick={onOpenTribes} />
          </>
        }
      >
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-white/70">North Star Theme</label>
            <TextInput value={state.northStar} onChange={(v) => updateStateField(state, "northStar", v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-white/70">Year</label>
              <NumberInput value={state.year} onChange={(v)=> updateStateField(state, "year", v)} />
            </div>
            <div>
              <label className="text-sm text-white/70">Min months planned</label>
              <NumberInput value={state.cohesionRules.minMonthsPlanned} onChange={(v)=> updateNested(state, "cohesionRules", { minMonthsPlanned: v })} />
            </div>
          </div>
          <div>
            <label className="text-sm text-white/70">Pillars (press Enter)</label>
            <TagsEditor tags={state.pillars} onChange={(tags)=> updateStateField(state, "pillars", tags)} />
          </div>
          <div>
            <label className="text-sm text-white/70">Guardrails (press Enter)</label>
            <TagsEditor tags={state.guardrails} onChange={(tags)=> updateStateField(state, "guardrails", tags)} />
          </div>
        </div>
      </Section>

      <Section title="Storyboard by Market" actions={null}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Select
            value={selectedMarket?.id}
            onChange={onSelectMarket}
            options={state.markets.map((m)=>({ value:m.id, label:m.name }))}
            placeholder="Select market"
          />
          <div className="ml-auto flex items-center gap-3 text-sm text-white/70 flex-wrap">
            <div className="flex items-center gap-2">
              <span>Legend:</span>
              {state.concepts.map((c)=> (
                <span key={c.id} className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded" style={{ background:c.color }} />
                  <span className="text-white/70 text-xs">{c.name}</span>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span>Tribes:</span>
              {state.tribes.map((t)=> (
                <span key={t.id} className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-[11px]">{t.name}</span>
              ))}
            </div>
          </div>
        </div>

        <MarketGrid
          state={state}
          market={selectedMarket}
          onEditCell={(month)=> onEditCell({ month, marketId: selectedMarket.id })}
        />
      </Section>
    </>
  );
}

function CohesionTab({ state, cohesion }) {
  return (
    <>
      <Section title="Cohesion Overview" actions={null}>
        <div className="grid md:grid-cols-3 gap-4">
          {state.markets.map((m)=> {
            const r = cohesion.byMarket[m.id];
            return (
              <div key={m.id} className="rounded-2xl border border-white/10 p-4 bg-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{m.name}</div>
                  <TrafficLight score={r.score} />
                </div>
                <div className="text-sm text-white/70 mb-2">Score: {r.score}/100</div>
                <div className="flex flex-wrap gap-1 mb-3">
                  <Pill tone="neutral">Planned months: {r.stats.monthsPlanned}/12</Pill>
                  <Pill tone={r.stats.heroConceptsUsed <= state.cohesionRules.maxHeroConceptsPerMarket ? "good" : "warn"}>
                    Hero concepts: {r.stats.heroConceptsUsed}
                  </Pill>
                  <Pill tone={r.stats.totalConceptsUsed <= state.cohesionRules.maxTotalConceptsPerMarket ? "good" : "warn"}>
                    All concepts: {r.stats.totalConceptsUsed}
                  </Pill>
                </div>
                <ul className="space-y-1 text-sm list-disc list-inside">
                  {r.issues.length === 0 && <li className="text-emerald-300">No issues detected.</li>}
                  {r.issues.map((it, i)=> (
                    <li key={i} className="text-amber-300">{it}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}

function StoryboardTab({ state, marketId, setMarketId }) {
  const market = state.markets.find((m)=> m.id === marketId) || state.markets[0];
  const mp = (market && state.plan[market.id]) || {};

  const quarterMonths = (q) => [0,1,2].map(o => (q-1)*3 + o);

  function monthCard(mi) {
    const pl = mp[mi] || {};
    const concept = state.concepts.find((c)=> c.id === pl.conceptId);
    const tribes = (pl.tribes || []).map(id => state.tribes.find(t => t.id === id)?.name).filter(Boolean);
    const assetCount = Object.values(pl.assets || {}).filter(Boolean).length;
    const assetPct = Math.round( (assetCount / ASSET_CATALOG.length) * 100 );

    return (
      <div className="p-3 rounded-xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between">
          <div className="text-xs text-white/70">{MONTHS[mi]}</div>
          {concept && <span className="w-3 h-3 rounded" style={{ background: concept.color }} />}
        </div>
        <div className="mt-1 font-medium truncate" title={concept?.name}>{concept?.name || "—"}</div>
        <div className="mt-1 text-xs text-white/70 line-clamp-2" title={pl.notes || ""}>{pl.notes || ""}</div>
        <div className="mt-2 flex flex-wrap gap-1">
          {tribes.slice(0,3).map((t, i)=> (
            <span key={i} className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-[10px]">{t}</span>
          ))}
        </div>
        <div className="mt-2">
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400" style={{ width: `${assetPct}%` }} />
          </div>
          <div className="text-[10px] text-white/60 mt-1">Assets {assetCount}/{ASSET_CATALOG.length}</div>
        </div>
      </div>
    );
  }

  return (
    <Section title="Quarterly Storyboard" actions={null}>
      <div className="grid md:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="text-sm text-white/70">Market</label>
          <Select
            value={market?.id}
            onChange={setMarketId}
            options={state.markets.map((m)=>({ value:m.id, label:m.name }))}
            placeholder="Choose market"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        {[1,2,3,4].map((q)=> {
          const months = quarterMonths(q);
          const hasHero = months.some(mi => {
            const id = mp[mi]?.conceptId; return !!id && (state.concepts.find(c=> c.id===id)?.role === "Hero");
          });
          return (
            <div key={q} className="rounded-2xl border border-white/10 p-4 bg-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">Q{q}</div>
                <Pill tone={hasHero?"good":"warn"}>{hasHero?"Hero present":"No hero"}</Pill>
              </div>
              <div className="grid gap-2">
                {months.map(mi => (
                  <div key={mi}>{monthCard(mi)}</div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function ExportTab({ state, cohesion, marketId, setMarketId, exportRef }) {
  function doPrint() {
    setTimeout(() => window.print(), 50);
  }

  return (
    <>
      <Section
        title="Executive One‑Pager"
        actions={<IconButton label="Print / Save PDF" onClick={doPrint} />}
      >
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-sm text-white/70">Market</label>
            <Select
              value={marketId}
              onChange={setMarketId}
              options={state.markets.map((m)=>({ value:m.id, label:m.name }))}
              placeholder="Choose market"
            />
          </div>
          <div>
            <label className="text-sm text-white/70">Year</label>
            <NumberInput value={state.year} onChange={(v)=> updateStateField(state, "year", v)} />
          </div>
          <div className="flex items-end">
            <TrafficLight score={cohesion.byMarket[marketId]?.score ?? cohesion.overall} />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <OnePager state={state} cohesion={cohesion} marketId={marketId} ref={exportRef} />
        </div>
      </Section>
    </>
  );
}

function SettingsTab({ state, setState }) {
  const [jsonText, setJsonText] = useState(`
/* Paste exported JSON here to import, or click Export to view current state */
`);

  function exportJSON() {
    const data = JSON.stringify(state, null, 2);
    setJsonText(data);
  }
  function importJSON() {
    try {
      const parsed = JSON.parse(jsonText);
      setState(parsed);
      alert("Imported successfully.");
    } catch (e) {
      alert("Invalid JSON.");
    }
  }

  return (
    <>
      <Section title="Cohesion Rules" actions={null}>
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-white/70">Max Hero Concepts / Market</label>
            <NumberInput value={state.cohesionRules.maxHeroConceptsPerMarket} onChange={(v)=> updateNested(state, "cohesionRules", { maxHeroConceptsPerMarket: v })} />
          </div>
          <div>
            <label className="text-sm text-white/70">Min Repeats per Hero</label>
            <NumberInput value={state.cohesionRules.minRepeatsPerHero} onChange={(v)=> updateNested(state, "cohesionRules", { minRepeatsPerHero: v })} />
          </div>
          <div>
            <label className="text-sm text-white/70">Min Months Planned</label>
            <NumberInput value={state.cohesionRules.minMonthsPlanned} onChange={(v)=> updateNested(state, "cohesionRules", { minMonthsPlanned: v })} />
          </div>
          <div>
            <label className="text-sm text-white/70">Max Concepts / Market</label>
            <NumberInput value={state.cohesionRules.maxTotalConceptsPerMarket} onChange={(v)=> updateNested(state, "cohesionRules", { maxTotalConceptsPerMarket: v })} />
          </div>
        </div>
      </Section>

      <Section
        title="Import / Export JSON"
        actions={
          <>
            <IconButton label="Export" onClick={exportJSON} />
            <IconButton label="Import" onClick={importJSON} />
          </>
        }
      >
        <textarea value={jsonText} onChange={(e)=> setJsonText(e.target.value)} rows={12} className="w-full p-3 rounded-2xl bg-black/30 border border-white/10 font-mono text-sm" />
      </Section>

      <Section
        title="Danger Zone"
        actions={<IconButton label="Reset to Defaults" onClick={()=> { localStorage.removeItem(LS_KEY); window.location.reload(); }} />}
      >
        <p className="text-sm text-white/70">Resets the planner to a clean slate with sample concepts, tribes, and markets.</p>
      </Section>
    </>
  );
}

// ---------- Components ----------
function MarketGrid({ state, market, onEditCell }) {
  const mp = state.plan[market.id] || {};

  return (
    <div className="overflow-x-auto border border-white/10 rounded-2xl">
      <table className="min-w-full text-sm">
        <thead className="bg-white/5">
          <tr>
            {MONTHS.map((m) => (
              <th key={m} className="px-3 py-2 text-left font-medium text-white/80">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {MONTHS.map((m, i) => {
              const cell = mp[i];
              const concept = state.concepts.find((c)=> c.id === cell?.conceptId);
              const tribes = (cell?.tribes || []).map(id => state.tribes.find(t => t.id === id)?.name).filter(Boolean);
              const assetCount = Object.values(cell?.assets || {}).filter(Boolean).length;
              const assetPct = Math.round( (assetCount/ASSET_CATALOG.length) * 100 );
              return (
                <td key={m} className="align-top">
                  <button
                    className={classNames(
                      "w-full h-32 p-3 text-left border border-white/10 hover:border-white/20 transition",
                      "bg-gradient-to-br from-white/0 to-white/5",
                      "focus:outline-none focus:ring-2 focus:ring-sky-500",
                      "rounded-none"
                    )}
                    onClick={() => onEditCell(i)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-white/60">{m}</span>
                      {concept && <span className="w-2.5 h-2.5 rounded-full" style={{ background: concept.color }} />}
                    </div>
                    {concept ? (
                      <div>
                        <div className="font-semibold truncate" title={concept.name}>{concept.name}</div>
                        <div className="text-[11px] text-white/60 truncate" title={cell?.notes || ""}>{cell?.notes || ""}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {tribes.slice(0,2).map((t, idx)=> (
                            <span key={idx} className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-[10px]">{t}</span>
                          ))}
                        </div>
                        <div className="mt-1 h-1 w-full bg-white/10 rounded overflow-hidden">
                          <div className="h-full bg-emerald-400" style={{ width: `${assetPct}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div className="text-white/40 text-xs italic">Click to assign</div>
                    )}
                  </button>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function EditCellForm({ state, cell, onChange, onRemove }) {
  const concepts = state.concepts;
  const mp = state.plan[cell.marketId] || {};
  const current = mp[cell.month] || {};

  const assets = current.assets || {};
  const completed = Object.values(assets).filter(Boolean).length;
  const pct = Math.round((completed/ASSET_CATALOG.length)*100);

  return (
    <div className="grid gap-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-white/70">Concept</label>
          <Select
            value={current.conceptId}
            onChange={(v)=> onChange({ conceptId: v })}
            options={concepts.map((c)=> ({ value: c.id, label: `${c.name} ${c.role === "Hero" ? "(Hero)" : ""}` }))}
            placeholder="Pick concept"
          />
        </div>
        <div>
          <label className="text-sm text-white/70">Budget (USD)</label>
          <NumberInput value={current.budget} onChange={(v)=> onChange({ budget: v })} />
        </div>
      </div>

      <div>
        <label className="text-sm text-white/70">Channels (press Enter)</label>
        <TagsEditor tags={current.channels || []} onChange={(tags)=> onChange({ channels: tags })} placeholder="e.g., Meta Ads, Google Search, CRM, PR" />
      </div>

      <div>
        <label className="text-sm text-white/70">Target Tribes</label>
        <MultiCheck
          options={state.tribes.map(t=> ({ value:t.id, label:t.name }))}
          values={current.tribes || []}
          onChange={(vals)=> onChange({ tribes: vals })}
        />
      </div>

      <div>
        <label className="text-sm text-white/70">Notes</label>
        <textarea
          value={current.notes || ""}
          onChange={(e)=> onChange({ notes: e.target.value })}
          rows={4}
          className="w-full p-3 rounded-2xl bg-black/30 border border-white/10"
          placeholder="Key message, hero asset, CTA, audiences…"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-white/70">Assets Checklist</label>
          <span className="text-xs text-white/60">{completed}/{ASSET_CATALOG.length} ({pct}%)</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {ASSET_CATALOG.map((a)=> (
            <Checkbox key={a} label={a} checked={!!assets[a]} onChange={(val)=> onChange({ assets: { ...assets, [a]: val } })} />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-white/60">Tip: Assign each hero concept to at least {state.cohesionRules.minRepeatsPerHero} months across the year.</div>
        <button onClick={onRemove} className="px-3 py-1.5 rounded-xl bg-rose-600/20 border border-rose-600/30 text-rose-300 hover:bg-rose-600/30">Clear</button>
      </div>
    </div>
  );
}

function ConceptsManager({ concepts, onAdd, onRemove }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("Hero");
  const [tags, setTags] = useState([]);
  const [color, setColor] = useState(SEED_COLOURS[Math.floor(Math.random()*SEED_COLOURS.length)]);

  function add() {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), role, tags, color });
    setName(""); setRole("Hero"); setTags([]);
  }

  return (
    <div className="grid gap-4">
      <div className="grid md:grid-cols-4 gap-3">
        <div>
          <label className="text-sm text-white/70">Name</label>
          <TextInput value={name} onChange={setName} placeholder="e.g., Culinary Passport" />
        </div>
        <div>
          <label className="text-sm text-white/70">Role</label>
          <Select value={role} onChange={setRole} options={[{value:"Hero", label:"Hero"},{value:"Support", label:"Support"}]} placeholder="Role" />
        </div>
        <div>
          <label className="text-sm text-white/70">Colour</label>
          <input type="color" value={color} onChange={(e)=> setColor(e.target.value)} className="w-full h-10 rounded-xl bg-black/20 border border-white/15" />
        </div>
        <div className="flex items-end">
          <IconButton label="Add Concept" onClick={add} />
        </div>
      </div>
      <div>
        <label className="text-sm text-white/70">Tags (press Enter)</label>
        <TagsEditor tags={tags} onChange={setTags} placeholder="e.g., wellness, food, couples" />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {concepts.map((c)=> (
          <div key={c.id} className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/5">
            <span className="w-4 h-4 rounded" style={{ background:c.color }} />
            <div className="flex-1">
              <div className="font-medium">{c.name} <span className="text-xs text-white/50">{c.role}</span></div>
              <div className="text-xs text-white/60">{c.tags?.join(", ")}</div>
            </div>
            <button onClick={()=> onRemove(c.id)} className="px-2 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20">Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketsManager({ markets, onAdd }) {
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");

  function add() {
    if (!name.trim()) return;
    onAdd(name.trim(), region.trim() || undefined);
    setName(""); setRegion("");
  }

  return (
    <div className="grid gap-4">
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-white/70">Market name</label>
          <TextInput value={name} onChange={setName} placeholder="e.g., United Kingdom" />
        </div>
        <div>
          <label className="text-sm text-white/70">Region / Code (optional)</label>
          <TextInput value={region} onChange={setRegion} placeholder="e.g., UK" />
        </div>
        <div className="flex items-end">
          <IconButton label="Add Market" onClick={add} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {markets.map((m)=> (
          <div key={m.id} className="p-3 rounded-2xl border border-white/10 bg-white/5">
            <div className="font-medium">{m.name}</div>
            <div className="text-xs text-white/60">{m.region || "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TribesManager({ tribes, onAdd }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggers, setTriggers] = useState([]);
  const [channels, setChannels] = useState([]);

  function add() {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), description: description.trim(), triggers, channels });
    setName(""); setDescription(""); setTriggers([]); setChannels([]);
  }

  return (
    <div className="grid gap-4">
      <div className="grid md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="text-sm text-white/70">Name</label>
          <TextInput value={name} onChange={setName} placeholder="e.g., Design Lovers & Art Seekers" />
        </div>
        <div className="md:col-span-2 flex items-end">
          <IconButton label="Add Tribe" onClick={add} />
        </div>
      </div>
      <div>
        <label className="text-sm text-white/70">Description</label>
        <textarea value={description} onChange={(e)=> setDescription(e.target.value)} rows={3} className="w-full p-3 rounded-2xl bg-black/30 border border-white/10" placeholder="Why they travel, what they crave" />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-white/70">Triggers (press Enter)</label>
          <TagsEditor tags={triggers} onChange={setTriggers} placeholder="e.g., chef’s table, spa circuits" />
        </div>
        <div>
          <label className="text-sm text-white/70">Channels (press Enter)</label>
          <TagsEditor tags={channels} onChange={setChannels} placeholder="e.g., IG, Search, Email" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {tribes.map((t)=> (
          <div key={t.id} className="p-3 rounded-2xl border border-white/10 bg-white/5">
            <div className="font-semibold">{t.name}</div>
            <div className="text-sm text-white/80">{t.description}</div>
            <div className="mt-2 text-[11px] text-white/70"><b>Triggers:</b> {t.triggers.join(", ")}</div>
            <div className="text-[11px] text-white/70"><b>Channels:</b> {t.channels.join(", ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TagsEditor = ({ tags, onChange, placeholder }) => {
  const [value, setValue] = useState("");

  function onKeyDown(e) {
    if (e.key === "Enter" && value.trim()) {
      e.preventDefault();
      onChange([...(tags || []), value.trim()]);
      setValue("");
    }
    if (e.key === "Backspace" && !value && (tags?.length)) {
      onChange(tags.slice(0, -1));
    }
  }

  function removeTag(i) {
    const next = [...tags]; next.splice(i,1); onChange(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-black/20 border border-white/15">
      {(tags || []).map((t, i)=> (
        <span key={`${t}-${i}`} className="px-2 py-1 rounded-full bg-white/10 border border-white/20 text-xs flex items-center gap-2">
          {t}
          <button onClick={()=> removeTag(i)} className="text-white/60 hover:text-white">×</button>
        </span>
      ))}
      <input
        value={value}
        onChange={(e)=> setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder || "Add tag and press Enter"}
        className="flex-1 min-w-[10rem] bg-transparent outline-none text-sm placeholder:text-white/40"
      />
    </div>
  );
};

const MultiCheck = ({ options, values, onChange }) => {
  const setVal = (v, checked) => {
    const set = new Set(values || []);
    checked ? set.add(v) : set.delete(v);
    onChange(Array.from(set));
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o)=> (
        <button
          key={o.value}
          onClick={(e)=> { e.preventDefault(); setVal(o.value, !(values||[]).includes(o.value)); }}
          className={classNames(
            "px-2 py-1 rounded-full border text-xs",
            (values||[]).includes(o.value) ? "bg-emerald-500/20 border-emerald-400 text-emerald-200" : "bg-white/10 border-white/20 text-white/70"
          )}
        >{o.label}</button>
      ))}
    </div>
  );
};

const TrafficLight = ({ score }) => {
  const label = score >= 80 ? "Green" : score >= 60 ? "Amber" : "Red";
  return (
    <div className="flex items-center gap-2">
      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" style={{ opacity: score>=80?1:0.2 }} />
      <div className="w-2.5 h-2.5 rounded-full bg-amber-400" style={{ opacity: score>=60 && score<80?1:0.2 }} />
      <div className="w-2.5 h-2.5 rounded-full bg-rose-500" style={{ opacity: score<60?1:0.2 }} />
      <span className="text-sm text-white/80">{label}</span>
    </div>
  );
};

// ---------- One‑Pager ----------
const OnePager = React.forwardRef(({ state, cohesion, marketId }, ref) => {
  const market = state.markets.find((m)=> m.id === marketId) || state.markets[0];
  const mp = (market && state.plan[market.id]) || {};
  const placements = MONTHS.map((_, i)=> ({ month:i, placement: mp[i] })).filter(x => x.placement && x.placement.conceptId);
  const score = market ? (cohesion.byMarket[market.id]?.score ?? 0) : 0;
  const conceptName = (id)=> state.concepts.find((c)=> c.id === id)?.name || "—";

  const topMessages = placements.map(p => p.placement?.notes).filter(Boolean).slice(0,3);
  const topTribes = [...new Set(placements.flatMap(p => (p.placement?.tribes || []).map(id => state.tribes.find(t=> t.id===id)?.name).filter(Boolean)))].slice(0,4);
  const assetReady = Math.round(
    (placements.reduce((a, p)=> a + (Object.values(p.placement?.assets || {}).filter(Boolean).length), 0)) /
    (ASSET_CATALOG.length * Math.max(placements.length, 1)) * 100
  );

  return (
    <div ref={ref} className="bg-white text-neutral-900">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{market?.name} — {state.year}</h1>
            <div className="text-sm text-neutral-600">Executive Campaign One‑Pager</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-neutral-600">Cohesion</div>
            <div className="text-xl font-bold">{score}/100</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <h2 className="text-sm font-semibold tracking-wide text-neutral-600">North Star</h2>
            <div className="text-lg font-medium">{state.northStar}</div>
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-neutral-600">Pillars</h2>
            <ul className="list-disc list-inside text-sm">
              {state.pillars.map((p, i)=> <li key={i}>{p}</li>)}
            </ul>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-neutral-600">Calendar</h2>
          <div className="mt-2 grid grid-cols-12 text-xs gap-1">
            {MONTHS.map((m, i) => {
              const pl = mp[i];
              const name = conceptName(pl?.conceptId);
              const color = state.concepts.find((c)=> c.id === pl?.conceptId)?.color || "#e5e7eb";
              return (
                <div key={m} className="border rounded-md p-2 h-18" style={{ borderColor: "#e5e7eb" }}>
                  <div className="font-medium text-[11px] text-neutral-600">{m}</div>
                  <div className="mt-1 text-[11px] truncate" title={name} style={{ color: color }}>{name}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <h2 className="text-sm font-semibold tracking-wide text-neutral-600">Top Messages / Hooks</h2>
            <ol className="list-decimal list-inside text-sm space-y-1">
              {topMessages.length ? topMessages.map((t, i)=> <li key={i}>{t}</li>) : <li>—</li>}
            </ol>
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-neutral-600">Channels</h2>
            <ul className="text-sm list-disc list-inside">
              {[...new Set(placements.flatMap(p => p.placement?.channels || []))].slice(0,8).map((c,i)=> <li key={i}>{c}</li>)}
            </ul>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-6">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-neutral-600">Budget (sum)</h2>
            <div className="text-xl font-semibold">${placements.reduce((a, p)=> a + (p.placement?.budget || 0), 0).toLocaleString()}</div>
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-neutral-600">Target Tribes (top)</h2>
            <div className="text-sm">{topTribes.join(", ") || "—"}</div>
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-neutral-600">Asset Readiness</h2>
            <div className="text-xl font-semibold">{assetReady}%</div>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-neutral-600">Guardrails</h2>
          <ul className="list-disc list-inside text-sm">
            {state.guardrails.slice(0,3).map((g, i)=> <li key={i}>{g}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
});

// ---------- Cohesion logic ----------
function analyseCohesion(state) {
  const byMarket = {};
  const r = state.cohesionRules;

  for (const m of state.markets) {
    const mp = state.plan[m.id] || {};
    const monthsPlanned = MONTHS.filter((_, i)=> !!mp[i]?.conceptId).length;

    const usedConceptIds = MONTHS.map((_, i)=> mp[i]?.conceptId).filter(Boolean);
    const uniqueConceptIds = Array.from(new Set(usedConceptIds));

    const conceptById = Object.fromEntries(state.concepts.map((c)=> [c.id, c]));

    const heroConceptIds = uniqueConceptIds.filter((id)=> conceptById[id]?.role === "Hero");
    const totalConceptsUsed = uniqueConceptIds.length;

    const heroRepeats = {};
    usedConceptIds.forEach(id => {
      if (conceptById[id]?.role === "Hero") heroRepeats[id] = (heroRepeats[id] || 0) + 1;
    });

    let score = 100;
    const localIssues = [];

    if (monthsPlanned < r.minMonthsPlanned) {
      localIssues.push(`Only ${monthsPlanned}/12 months planned (min ${r.minMonthsPlanned}).`);
      score -= (r.minMonthsPlanned - monthsPlanned) * 2;
    }

    if (heroConceptIds.length > r.maxHeroConceptsPerMarket) {
      localIssues.push(`Too many hero concepts: ${heroConceptIds.length} (max ${r.maxHeroConceptsPerMarket}).`);
      score -= (heroConceptIds.length - r.maxHeroConceptsPerMarket) * 5;
    }

    Object.entries(heroRepeats).forEach(([id, n]) => {
      if (n < r.minRepeatsPerHero) {
        localIssues.push(`Hero “${conceptById[id].name}” repeats ${n}× (min ${r.minRepeatsPerHero}).`);
        score -= (r.minRepeatsPerHero - n) * 4;
      }
    });

    for (let q = 1; q <= 4; q++) {
      const months = [0,1,2].map(o => (q-1)*3 + o);
      const hasHero = months.some(mi => {
        const id = mp[mi]?.conceptId; return !!id && conceptById[id]?.role === "Hero";
      });
      if (!hasHero) { localIssues.push(`No hero presence in Q${q}.`); score -= 6; }
    }

    score = clamp(score, 0, 100);

    byMarket[m.id] = {
      score,
      stats: { monthsPlanned, heroConceptsUsed: heroConceptIds.length, totalConceptsUsed },
      issues: localIssues,
    };
  }

  const overall = Math.round(
    Object.values(byMarket).reduce((a, b) => a + b.score, 0) /
    Math.max(1, (state.markets || []).length)
  );

  return { overall, byMarket };
}

// ---------- State helpers ----------
function updateStateField(state, key, value) {
  const next = { ...state, [key]: value };
  localStorage.setItem(LS_KEY, JSON.stringify(next));
  const ev = new Event("storage");
  window.dispatchEvent(ev);
}

function updateNested(state, key, patch) {
  const next = { ...state, [key]: { ...state[key], ...patch } };
  localStorage.setItem(LS_KEY, JSON.stringify(next));
  const ev = new Event("storage");
  window.dispatchEvent(ev);
}

// ---------- Inline self‑tests ----------
(function runSelfTests(){
  const results = [];
  const assert = (name, cond) => { results.push({ name, passed: !!cond }); (cond ? console.log : console.error)(`[TEST] ${cond ? 'PASS' : 'FAIL'}: ${name}`); };

  // Test: uid uniqueness
  const a = uid('t'); const b = uid('t');
  assert('uid() returns unique values', a !== b);

  // Test: quarterOf mapping
  assert('quarterOf(0) === 1', quarterOf(0) === 1);
  assert('quarterOf(3) === 2', quarterOf(3) === 2);
  assert('quarterOf(11) === 4', quarterOf(11) === 4);

  // Test: clamp boundaries
  assert('clamp(5, 0, 3) === 3', clamp(5, 0, 3) === 3);
  assert('clamp(-1, 0, 3) === 0', clamp(-1, 0, 3) === 0);

  // Test: default tribes present (5)
  assert('DEFAULT_TRIBES has 5 items', DEFAULT_TRIBES.length === 5);

  // Test: ASSET_CATALOG non‑empty
  assert('ASSET_CATALOG has items', ASSET_CATALOG.length > 0);

  // Test: analyseCohesion flags missing heroes by quarter
  const testState = {
    year: 2025,
    northStar: '', pillars: [], guardrails: [],
    concepts: [{ id:'H', name:'Hero X', role:'Hero', tags:[], color:'#000' }],
    tribes: [],
    markets: [{ id:'M1', name:'X' }],
    plan: { M1: { 0: { conceptId: 'H' } } }, // only January has hero
    cohesionRules: { maxHeroConceptsPerMarket: 4, minRepeatsPerHero: 3, minMonthsPlanned: 10, maxTotalConceptsPerMarket: 8 }
  };
  const coh = analyseCohesion(testState);
  const issues = coh.byMarket['M1'].issues.join(' | ');
  assert('Cohesion detects missing hero in Q2', issues.includes('Q2'));
  assert('Cohesion detects missing hero in Q3', issues.includes('Q3'));
  assert('Cohesion detects missing hero in Q4', issues.includes('Q4'));

  // Expose results for inspection
  // @ts-ignore
  window.__CS_TEST_RESULTS = results;
})();

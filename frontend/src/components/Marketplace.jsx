import { useState, useEffect } from "react";

const REGIONS = ["", "North America", "Europe", "Asia", "Africa", "South America"];
const TYPES = ["", "GPU", "Supercomputer"];
const LISTINGS = ["", "A", "B", "C"];

export default function Marketplace({ api, activeUser, showToast, refreshUser }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: "", listing_type: "", region: "" });
  const [allocating, setAllocating] = useState(null);
  const [modal, setModal] = useState(null); // { resource } for manual buy

  // Manual buy form state
  const [manualDur, setManualDur] = useState(1);

  // Auto-buy form
  const [autoForm, setAutoForm] = useState({ req_type: "GPU", req_listing_type: "A", duration_hours: 1 });
  const [showAutoPanel, setShowAutoPanel] = useState(false);

  const load = () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filters.type) p.append("type", filters.type);
    if (filters.listing_type) p.append("listing_type", filters.listing_type);
    if (filters.region) p.append("region", filters.region);
    fetch(`${api}/resources?${p}`).then(r => r.json()).then(d => { setResources(d); setLoading(false); });
  };

  useEffect(() => { load(); }, [filters]);

  const handleAutoBuy = async () => {
    setAllocating("auto");
    try {
      const res = await fetch(`${api}/allocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consumer_id: activeUser.user_id,
          req_type: autoForm.req_type,
          req_listing_type: autoForm.req_listing_type,
          duration_hours: parseInt(autoForm.duration_hours),
          selection_mode: "Automatic",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      showToast(`Allocated! ${data.resource.type} in ${data.resource.region} · ₢${data.total_cost.toFixed(2)} deducted`);
      refreshUser();
      load();
      setShowAutoPanel(false);
    } catch (e) {
      showToast(e.message, "error");
    }
    setAllocating(null);
  };

  const handleManualBuy = async () => {
    setAllocating(modal.resource_id);
    try {
      const res = await fetch(`${api}/allocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consumer_id: activeUser.user_id,
          req_type: modal.type,
          req_listing_type: modal.listing_type,
          duration_hours: parseInt(manualDur),
          selection_mode: "Manual",
          resource_id: modal.resource_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      showToast(`Allocated ${modal.type} for ₢${data.total_cost.toFixed(2)}`);
      refreshUser();
      load();
      setModal(null);
    } catch (e) {
      showToast(e.message, "error");
    }
    setAllocating(null);
  };

  const isConsumer = activeUser.role !== "Host";

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1 className="page-title">Compute Marketplace</h1>
        {isConsumer && (
          <button className="btn-primary" onClick={() => setShowAutoPanel(!showAutoPanel)}>
            ⚡ Auto-Buy
          </button>
        )}
      </div>

      {/* Auto-buy panel */}
      {showAutoPanel && isConsumer && (
        <div className="auto-panel">
          <div className="panel-header">
            <span className="panel-title">Auto-Allocate (Nearest Available)</span>
          </div>
          <div className="auto-form">
            <label className="form-group">
              <span className="form-label">Type</span>
              <select className="form-select" value={autoForm.req_type}
                onChange={e => setAutoForm(f => ({ ...f, req_type: e.target.value }))}>
                <option>GPU</option><option>Supercomputer</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Tier</span>
              <select className="form-select" value={autoForm.req_listing_type}
                onChange={e => setAutoForm(f => ({ ...f, req_listing_type: e.target.value }))}>
                <option>A</option><option>B</option><option>C</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Duration (hrs)</span>
              <input type="number" min="1" max="720" className="form-input" value={autoForm.duration_hours}
                onChange={e => setAutoForm(f => ({ ...f, duration_hours: e.target.value }))} />
            </label>
            <button className="btn-primary" onClick={handleAutoBuy} disabled={allocating === "auto"}>
              {allocating === "auto" ? "Searching..." : "⚡ Find & Allocate"}
            </button>
          </div>
          <div className="auto-note">Uses Haversine distance to find the nearest matching resource to your location.</div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-row">
        <select className="filter-select" value={filters.type}
          onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
          {TYPES.map(t => <option key={t} value={t}>{t || "All Types"}</option>)}
        </select>
        <select className="filter-select" value={filters.listing_type}
          onChange={e => setFilters(f => ({ ...f, listing_type: e.target.value }))}>
          {LISTINGS.map(l => <option key={l} value={l}>{l ? `Tier ${l}` : "All Tiers"}</option>)}
        </select>
        <select className="filter-select" value={filters.region}
          onChange={e => setFilters(f => ({ ...f, region: e.target.value }))}>
          {REGIONS.map(r => <option key={r} value={r}>{r || "All Regions"}</option>)}
        </select>
        <span className="filter-count">{resources.length} resources</span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="loading-state">Loading marketplace...</div>
      ) : resources.length === 0 ? (
        <div className="empty-state">No available resources match your filters.</div>
      ) : (
        <div className="resource-grid">
          {resources.map(r => (
            <div key={r.resource_id} className="resource-card">
              <div className="resource-card-top">
                <span className={`type-badge type-badge--${r.type === "GPU" ? "gpu" : "sc"} type-badge--lg`}>
                  {r.type === "GPU" ? "GPU" : "SC"}
                </span>
                <span className="tier-badge">Tier {r.listing_type}</span>
              </div>
              <div className="resource-host">{r.host_name}</div>
              <div className="resource-region">📍 {r.region}</div>
              <div className="resource-price">
                <span className="price-val">₢{parseFloat(r.hourly_cost).toFixed(2)}</span>
                <span className="price-unit">/hr</span>
              </div>
              {isConsumer && (
                <button
                  className="btn-outline resource-btn"
                  onClick={() => { setModal(r); setManualDur(1); }}
                  disabled={!!allocating}
                >
                  Allocate
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Manual allocate modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Allocate Resource</div>
            <div className="modal-detail">
              <div className="modal-row"><span>Type</span><strong>{modal.type}</strong></div>
              <div className="modal-row"><span>Tier</span><strong>{modal.listing_type}</strong></div>
              <div className="modal-row"><span>Host</span><strong>{modal.host_name}</strong></div>
              <div className="modal-row"><span>Region</span><strong>{modal.region}</strong></div>
              <div className="modal-row"><span>Rate</span><strong>₢{parseFloat(modal.hourly_cost).toFixed(2)}/hr</strong></div>
            </div>
            <label className="form-group">
              <span className="form-label">Duration (hours)</span>
              <input type="number" min="1" max="720" className="form-input"
                value={manualDur} onChange={e => setManualDur(e.target.value)} />
            </label>
            <div className="modal-cost">
              Total: <strong>₢{(parseFloat(modal.hourly_cost) * manualDur).toFixed(2)}</strong>
              <span className="modal-balance"> · Balance: ₢{parseFloat(activeUser.credit_balance).toFixed(2)}</span>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleManualBuy} disabled={!!allocating}>
                {allocating ? "Processing..." : "Confirm Allocation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

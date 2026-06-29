import { useState, useEffect } from "react";

const REGIONS = ["North America", "Europe", "Asia", "Africa", "South America"];

export default function HostPanel({ api, activeUser, showToast }) {
  const [allocations, setAllocations] = useState([]);
  const [myResources, setMyResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type: "GPU", listing_type: "A", region: "North America", hourly_cost: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${api}/host/${activeUser.user_id}/allocations`).then(r => r.json()),
      fetch(`${api}/host/${activeUser.user_id}/resources`).then(r => r.json()),
    ]).then(([allocs, res]) => {
      setAllocations(allocs);
      setMyResources(res);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [activeUser.user_id]);

  const handleRegister = async () => {
    if (!form.hourly_cost || isNaN(form.hourly_cost)) {
      showToast("Enter a valid hourly cost", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${api}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, host_id: activeUser.user_id, hourly_cost: parseFloat(form.hourly_cost) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      showToast("Resource registered successfully!");
      setForm({ type: "GPU", listing_type: "A", region: "North America", hourly_cost: "" });
      load();
    } catch (e) {
      showToast(e.message, "error");
    }
    setSubmitting(false);
  };

  const toggleStatus = async (resource_id, currentStatus) => {
    const newStatus = currentStatus === "Available" ? "Offline" : "Available";
    try {
      await fetch(`${api}/resources/${resource_id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      showToast(`Resource set to ${newStatus}`);
      load();
    } catch (e) {
      showToast("Failed to update status", "error");
    }
  };

  const activeAllocs = allocations.filter(a => a.status === "Running");
  const pastAllocs = allocations.filter(a => a.status !== "Running");
  const totalEarnings = allocations.reduce((s, a) => s + (parseFloat(a.total_cost) || 0) * 0.9, 0);

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1 className="page-title">Host Dashboard</h1>
        <div className="host-earnings">
          Total Earnings: <span className="earnings-val">₢{totalEarnings.toFixed(2)}</span>
        </div>
      </div>

      <div className="two-col">
        {/* Register resource */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Register New Machine</span>
          </div>
          <div className="register-form">
            <label className="form-group">
              <span className="form-label">Resource Type</span>
              <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option>GPU</option>
                <option>Supercomputer</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Listing Tier</span>
              <select className="form-select" value={form.listing_type} onChange={e => setForm(f => ({ ...f, listing_type: e.target.value }))}>
                <option value="A">A — Standard</option>
                <option value="B">B — Performance</option>
                <option value="C">C — Enterprise</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Region</span>
              <select className="form-select" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}>
                {REGIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Hourly Rate (₢)</span>
              <input type="number" min="0.01" step="0.01" className="form-input"
                placeholder="e.g. 5.00"
                value={form.hourly_cost}
                onChange={e => setForm(f => ({ ...f, hourly_cost: e.target.value }))} />
            </label>
            <button className="btn-primary" onClick={handleRegister} disabled={submitting}>
              {submitting ? "Registering..." : "+ Register Machine"}
            </button>
          </div>
        </div>

        {/* My resources */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">My Machines</span>
            <button className="btn-ghost btn-sm" onClick={load}>↻</button>
          </div>
          {loading ? (
            <div className="loading-state-sm">Loading...</div>
          ) : myResources.length === 0 ? (
            <div className="empty-state-sm">No machines registered yet.</div>
          ) : (
            <div className="resource-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Tier</th>
                    <th>Region</th>
                    <th>Rate</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {myResources.map(r => (
                    <tr key={r.resource_id}>
                      <td><span className={`type-badge type-badge--${r.type === "GPU" ? "gpu" : "sc"}`}>{r.type === "GPU" ? "GPU" : "SC"}</span></td>
                      <td>{r.listing_type}</td>
                      <td className="text-muted">{r.region}</td>
                      <td>₢{parseFloat(r.hourly_cost).toFixed(2)}</td>
                      <td><span className={`status-pill status-pill--${r.status.toLowerCase()}`}>{r.status}</span></td>
                      <td>
                        {r.status !== "Busy" && (
                          <button className="btn-ghost btn-xs" onClick={() => toggleStatus(r.resource_id, r.status)}>
                            {r.status === "Available" ? "Go Offline" : "Go Online"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Active allocations */}
      <div className="panel mt-4">
        <div className="panel-header">
          <span className="panel-title">Active Consumer Allocations</span>
          <span className="badge">{activeAllocs.length} running</span>
        </div>
        {loading ? (
          <div className="loading-state-sm">Loading...</div>
        ) : activeAllocs.length === 0 ? (
          <div className="empty-state-sm">No resources currently in use by consumers.</div>
        ) : (
          <div className="resource-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th><th>Consumer</th><th>Type</th><th>Tier</th><th>Region</th><th>Cost</th><th>Since</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeAllocs.map(a => (
                  <tr key={a.allocation_id}>
                    <td className="text-muted">#{a.allocation_id}</td>
                    <td><strong>{a.consumer_name}</strong></td>
                    <td><span className={`type-badge type-badge--${a.type === "GPU" ? "gpu" : "sc"}`}>{a.type === "GPU" ? "GPU" : "SC"}</span></td>
                    <td>{a.listing_type}</td>
                    <td className="text-muted">{a.region}</td>
                    <td>₢{parseFloat(a.total_cost || 0).toFixed(2)}</td>
                    <td className="text-muted">{new Date(a.start_time).toLocaleString()}</td>
                    <td><span className="status-pill status-pill--running">{a.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Past allocations */}
      {pastAllocs.length > 0 && (
        <div className="panel mt-4">
          <div className="panel-header">
            <span className="panel-title">Past Allocations</span>
          </div>
          <div className="resource-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>ID</th><th>Consumer</th><th>Type</th><th>Revenue (90%)</th><th>Completed</th></tr>
              </thead>
              <tbody>
                {pastAllocs.map(a => (
                  <tr key={a.allocation_id}>
                    <td className="text-muted">#{a.allocation_id}</td>
                    <td>{a.consumer_name}</td>
                    <td><span className={`type-badge type-badge--${a.type === "GPU" ? "gpu" : "sc"}`}>{a.type === "GPU" ? "GPU" : "SC"}</span></td>
                    <td className="positive">+₢{(parseFloat(a.total_cost || 0) * 0.9).toFixed(2)}</td>
                    <td className="text-muted">{a.end_time ? new Date(a.end_time).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

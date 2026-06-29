import { useState, useEffect } from "react";

export default function Dashboard({ api }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`${api}/dashboard/stats`)
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); });
  };

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);

  if (loading && !stats) return <div className="loading-state">Connecting to network...</div>;

  const maxDemand = Math.max(...(stats?.region_demand?.map(r => r.active_count) || [1]), 1);

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1 className="page-title">System Overview</h1>
        <button className="btn-ghost" onClick={load}>↻ Refresh</button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-card--accent">
          <div className="kpi-label">ACTIVE ALLOCATIONS</div>
          <div className="kpi-value">{stats.active_allocations}</div>
          <div className="kpi-bar">
            <div className="kpi-bar-fill" style={{ width: `${Math.min(stats.active_allocations * 12, 100)}%` }} />
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">SYSTEM DEMAND</div>
          <div className="kpi-value">{stats.system_demand_pct}<span className="kpi-unit">%</span></div>
          <div className="kpi-bar">
            <div className="kpi-bar-fill kpi-bar-fill--warn" style={{ width: `${stats.system_demand_pct}%` }} />
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">PENDING QUEUE</div>
          <div className="kpi-value">{stats.pending_requests}</div>
          <div className="kpi-bar">
            <div className="kpi-bar-fill kpi-bar-fill--muted" style={{ width: `${Math.min(stats.pending_requests * 15, 100)}%` }} />
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">REGISTERED NODES</div>
          <div className="kpi-value">{stats.total_users}</div>
          <div className="kpi-bar">
            <div className="kpi-bar-fill kpi-bar-fill--green" style={{ width: `${Math.min(stats.total_users * 10, 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="two-col">
        {/* Region demand */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Regional Load</span>
            <span className="badge">LIVE</span>
          </div>
          <div className="region-list">
            {stats.region_demand.map(r => (
              <div key={r.region} className="region-row">
                <span className="region-name">{r.region}</span>
                <div className="region-bar-wrap">
                  <div
                    className="region-bar-fill"
                    style={{ width: `${(r.active_count / maxDemand) * 100}%` }}
                  />
                </div>
                <span className="region-count">{r.active_count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent allocations */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Recent Activity</span>
          </div>
          <div className="activity-list">
            {stats.recent_allocations.length === 0 && (
              <div className="empty-state-sm">No recent allocations</div>
            )}
            {stats.recent_allocations.map(a => (
              <div key={a.allocation_id} className="activity-row">
                <div className="activity-left">
                  <span className={`type-badge type-badge--${a.type === "GPU" ? "gpu" : "sc"}`}>
                    {a.type === "GPU" ? "GPU" : "SC"}
                  </span>
                  <div>
                    <div className="activity-consumer">{a.consumer}</div>
                    <div className="activity-region">{a.region}</div>
                  </div>
                </div>
                <div className="activity-right">
                  {a.total_cost && <div className="activity-cost">₢{parseFloat(a.total_cost).toFixed(2)}</div>}
                  <span className={`status-pill status-pill--${a.status.toLowerCase()}`}>{a.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

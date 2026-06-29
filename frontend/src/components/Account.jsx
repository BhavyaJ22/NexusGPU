import { useState, useEffect } from "react";

export default function Account({ api, activeUser, showToast, refreshUser }) {
  const [transactions, setTransactions] = useState([]);
  const [activeAllocs, setActiveAllocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addAmt, setAddAmt] = useState("");
  const [adding, setAdding] = useState(false);
  const [releasing, setReleasing] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${api}/users/${activeUser.user_id}/transactions`).then(r => r.json()),
      fetch(`${api}/users/${activeUser.user_id}/active-allocations`).then(r => r.json()),
    ]).then(([txs, allocs]) => {
      setTransactions(txs);
      setActiveAllocs(allocs);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [activeUser.user_id]);

  const handleAddCredits = async () => {
    const amount = parseFloat(addAmt);
    if (!amount || amount <= 0) { showToast("Enter a valid amount", "error"); return; }
    setAdding(true);
    try {
      const res = await fetch(`${api}/users/${activeUser.user_id}/add-credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: activeUser.user_id, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      showToast(`₢${amount.toFixed(2)} added to your account!`);
      setAddAmt("");
      refreshUser();
      load();
    } catch (e) {
      showToast(e.message, "error");
    }
    setAdding(false);
  };

  const handleRelease = async (allocation_id) => {
    setReleasing(allocation_id);
    try {
      const res = await fetch(`${api}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocation_id, consumer_id: activeUser.user_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      showToast("Allocation released. Resource now available.");
      refreshUser();
      load();
    } catch (e) {
      showToast(e.message, "error");
    }
    setReleasing(null);
  };

  const totalSpent = transactions.filter(t => t.type === "Debit").reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalEarned = transactions.filter(t => t.type === "Credit").reduce((s, t) => s + parseFloat(t.amount), 0);

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1 className="page-title">Account</h1>
      </div>

      <div className="account-top">
        {/* Profile card */}
        <div className="profile-card">
          <div className="profile-avatar">{activeUser.name.charAt(0)}</div>
          <div className="profile-info">
            <div className="profile-name">{activeUser.name}</div>
            <div className="profile-meta">
              <span className={`role-badge role-badge--${activeUser.role.toLowerCase().replace(" ", "")}`}>{activeUser.role}</span>
              <span className="text-muted">📍 {activeUser.region}</span>
            </div>
          </div>
          <div className="profile-balance">
            <div className="balance-label">CREDIT BALANCE</div>
            <div className="balance-value">₢{parseFloat(activeUser.credit_balance).toFixed(2)}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="account-stats">
          <div className="stat-card">
            <div className="stat-label">TOTAL SPENT</div>
            <div className="stat-val negative">₢{totalSpent.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">TOTAL EARNED</div>
            <div className="stat-val positive">₢{totalEarned.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">TRANSACTIONS</div>
            <div className="stat-val">{transactions.length}</div>
          </div>
        </div>
      </div>

      {/* Add credits */}
      <div className="panel">
        <div className="panel-header"><span className="panel-title">Top Up Credits</span></div>
        <div className="topup-row">
          {[50, 100, 200, 500].map(amt => (
            <button key={amt} className="quick-amt" onClick={() => setAddAmt(String(amt))}>₢{amt}</button>
          ))}
          <input type="number" min="1" className="form-input topup-input"
            placeholder="Custom amount" value={addAmt} onChange={e => setAddAmt(e.target.value)} />
          <button className="btn-primary" onClick={handleAddCredits} disabled={adding}>
            {adding ? "Adding..." : "+ Add Credits"}
          </button>
        </div>
      </div>

      {/* Active allocations */}
      {activeAllocs.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">My Active Allocations</span>
            <span className="badge">{activeAllocs.length}</span>
          </div>
          <div className="resource-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>ID</th><th>Type</th><th>Tier</th><th>Region</th><th>Cost</th><th>Since</th><th></th></tr>
              </thead>
              <tbody>
                {activeAllocs.map(a => (
                  <tr key={a.allocation_id}>
                    <td className="text-muted">#{a.allocation_id}</td>
                    <td><span className={`type-badge type-badge--${a.type === "GPU" ? "gpu" : "sc"}`}>{a.type === "GPU" ? "GPU" : "SC"}</span></td>
                    <td>{a.listing_type}</td>
                    <td className="text-muted">{a.region}</td>
                    <td>₢{parseFloat(a.total_cost || 0).toFixed(2)}</td>
                    <td className="text-muted">{new Date(a.start_time).toLocaleString()}</td>
                    <td>
                      <button className="btn-danger btn-sm"
                        onClick={() => handleRelease(a.allocation_id)}
                        disabled={releasing === a.allocation_id}>
                        {releasing === a.allocation_id ? "..." : "Release"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction ledger */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Transaction Ledger</span>
        </div>
        {loading ? (
          <div className="loading-state-sm">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="empty-state-sm">No transactions yet.</div>
        ) : (
          <div className="resource-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Type</th><th>Amount</th><th>Resource</th><th>Alloc ID</th><th>Timestamp</th></tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.trans_id}>
                    <td className="text-muted">{t.trans_id}</td>
                    <td>
                      <span className={`tx-type tx-type--${t.type.toLowerCase()}`}>{t.type}</span>
                    </td>
                    <td className={t.type === "Debit" ? "negative" : "positive"}>
                      {t.type === "Debit" ? "−" : "+"}₢{parseFloat(t.amount).toFixed(2)}
                    </td>
                    <td className="text-muted">
                      {t.resource_type ? `${t.resource_type} · ${t.region}` : "—"}
                    </td>
                    <td className="text-muted">{t.allocation_id ? `#${t.allocation_id}` : "—"}</td>
                    <td className="text-muted">{new Date(t.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import Dashboard from "./components/Dashboard";
import Marketplace from "./components/Marketplace";
import HostPanel from "./components/HostPanel";
import Account from "./components/Account";

const API = "http://localhost:8000";

export default function App() {
  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    fetch(`${API}/users`).then(r => r.json()).then(data => {
      setUsers(data);
      if (data.length > 0) setActiveUser(data[0]);
    });
  }, []);

  const refreshUser = useCallback(() => {
    if (!activeUser) return;
    fetch(`${API}/users/${activeUser.user_id}`)
      .then(r => r.json())
      .then(data => setActiveUser(data));
  }, [activeUser]);

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "⬡" },
    { id: "marketplace", label: "Marketplace", icon: "◈" },
    ...(activeUser && activeUser.role !== "Consumer"
      ? [{ id: "host", label: "Host Panel", icon: "◉" }]
      : []),
    { id: "account", label: "Account", icon: "◎" },
  ];

  return (
    <div className="app-shell">
      {/* Ambient background */}
      <div className="bg-grid" />
      <div className="bg-glow glow-1" />
      <div className="bg-glow glow-2" />

      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-mark">⬡</span>
          <div>
            <div className="brand-name">NEXUS<span>GPU</span></div>
            <div className="brand-sub">Decentralized Compute Network</div>
          </div>
        </div>

        <div className="user-selector">
          <span className="user-label">ACTIVE NODE</span>
          <select
            className="user-select"
            value={activeUser?.user_id || ""}
            onChange={e => {
              const u = users.find(u => u.user_id === parseInt(e.target.value));
              setActiveUser(u);
              setTab("dashboard");
            }}
          >
            {users.map(u => (
              <option key={u.user_id} value={u.user_id}>
                {u.name} · {u.role}
              </option>
            ))}
          </select>
          {activeUser && (
            <div className="user-credit">
              <span className="credit-label">₢</span>
              <span className="credit-val">{parseFloat(activeUser.credit_balance).toFixed(2)}</span>
            </div>
          )}
        </div>
      </header>

      {/* Nav */}
      <nav className="sidenav">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`nav-item ${tab === t.id ? "nav-item--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main className="content">
        {tab === "dashboard" && <Dashboard api={API} showToast={showToast} />}
        {tab === "marketplace" && activeUser && (
          <Marketplace api={API} activeUser={activeUser} showToast={showToast} refreshUser={refreshUser} />
        )}
        {tab === "host" && activeUser && (
          <HostPanel api={API} activeUser={activeUser} showToast={showToast} />
        )}
        {tab === "account" && activeUser && (
          <Account api={API} activeUser={activeUser} showToast={showToast} refreshUser={refreshUser} />
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`toast toast--${toast.type}`}>
          <span className="toast-icon">{toast.type === "success" ? "✓" : "✕"}</span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

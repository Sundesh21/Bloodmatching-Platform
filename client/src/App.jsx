import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Link, NavLink } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { useTheme } from "./context/ThemeContext.jsx";
import { useLanguage } from "./context/LanguageContext.jsx";
import { getSocket, onConnectionChange } from "./socket";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import NewRequest from "./pages/NewRequest.jsx";
import Donors from "./pages/Donors.jsx";
import Inventory from "./pages/Inventory.jsx";
import HospitalStock from "./pages/HospitalStock.jsx";
import Profile from "./pages/Profile.jsx";
import Admin from "./pages/Admin.jsx";
import ChatWidget from "./components/ChatWidget.jsx";

function Private({ children }) {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  if (loading) return <div className="page center">{t("common.loading")}</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function AdminOnly({ children }) {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  if (loading) return <div className="page center">{t("common.loading")}</div>;
  if (!user) return <Navigate to="/login" replace />;
  return user.role === "admin" ? children : <Navigate to="/dashboard" replace />;
}

/* Outlined droplet, echoing the mark in the reference design. */
function Droplet() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2.5c0 0-6.5 7.4-6.5 11.6a6.5 6.5 0 0 0 13 0C18.5 9.9 12 2.5 12 2.5z" />
      </svg>
    </span>
  );
}

export default function App() {
  const { user, setUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const [toasts, setToasts] = useState([]);
  const [online, setOnline] = useState(false);

  const isDark =
    theme === "dark" ||
    (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  // Live server connection status → green/red dot in the nav.
  useEffect(() => {
    if (!user) return;
    return onConnectionChange(setOnline);
  }, [user]);

  // If an admin approves/rejects this hospital while it's online,
  // refresh our own record so the UI unlocks without a re-login.
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    const onStatus = ({ status }) => {
      setUser((u) => (u ? { ...u, status } : u));
      pushToast(
        status === "active" ? t("toast.hospitalVerified") : t("toast.hospitalNotApproved")
      );
    };
    socket.on("account:status", onStatus);
    return () => socket.off("account:status", onStatus);
  }, [user, setUser]);

  // Live notifications: donors hear about matching requests,
  // requesters hear when a donor accepts.
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    const onNewMatch = ({ request, matchedBecause }) => {
      pushToast(
        t("toast.newMatch", {
          bloodGroup: request.bloodGroup,
          patientName: request.patientName,
          city: request.city,
          reason: matchedBecause,
        })
      );
    };
    const onAccepted = ({ donor }) => {
      pushToast(
        t("toast.accepted", {
          name: donor.name,
          bloodGroup: donor.bloodGroup,
          phone: donor.phone || t("toast.phoneFallback"),
        })
      );
    };

    socket.on("request:new", onNewMatch);
    socket.on("request:accepted", onAccepted);
    return () => {
      socket.off("request:new", onNewMatch);
      socket.off("request:accepted", onAccepted);
    };
  }, [user]);

  function pushToast(text) {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 8000);
  }

  return (
    <>
      <header className="nav">
        <Link to="/" className="brand">
          <Droplet />
          Rakta<span>Setu</span>
        </Link>
        {user ? (
          <nav>
            <NavLink to="/" end>
              {t("nav.home")}
            </NavLink>
            {user.role === "admin" ? (
              <NavLink to="/admin">{t("nav.admin")}</NavLink>
            ) : (
              <NavLink to="/dashboard">{t("nav.dashboard")}</NavLink>
            )}
            {(user.role === "requester" || (user.role === "hospital" && user.status === "active")) && (
              <NavLink to="/request">{t("nav.requestBlood")}</NavLink>
            )}
            {user.role !== "admin" && (user.role !== "hospital" || user.status === "active") && (
              <NavLink to="/donors">{t("nav.findDonors")}</NavLink>
            )}
            <NavLink to="/inventory">{t("nav.hospitalStock")}</NavLink>
            {user.role === "hospital" && <NavLink to="/my-stock">{t("nav.myStock")}</NavLink>}
            <NavLink to="/profile">{t("nav.profile")}</NavLink>
            {(() => {
              // Green pill follows donate availability (toggled in Profile/Dashboard),
              // but still goes red if the live server connection drops.
              const live = online && user.isAvailable !== false;
              return (
                <span
                  className={`conn ${live ? "online" : "offline"}`}
                  title={live ? t("nav.onlineTitle") : t("nav.offlineTitle")}
                >
                  <span className="status-dot" />
                  {live ? t("nav.online") : t("nav.offline")}
                </span>
              );
            })()}
            <LangSwitch lang={lang} setLang={setLang} />
            <button
              className="icon-btn"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? "☀️" : "🌙"}
            </button>
            <button className="btn ghost" onClick={logout}>
              {t("nav.logout")}
            </button>
          </nav>
        ) : (
          <nav>
            <NavLink to="/" end>
              {t("nav.home")}
            </NavLink>
            <NavLink to="/register">{t("nav.signup")}</NavLink>
            <NavLink to="/login" className="btn outline">
              {t("nav.login")}
            </NavLink>
            <LangSwitch lang={lang} setLang={setLang} />
            <button
              className="icon-btn"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? "☀️" : "🌙"}
            </button>
          </nav>
        )}
      </header>

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>

      {user && <ChatWidget />}

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
        <Route path="/request" element={<Private><NewRequest /></Private>} />
        <Route path="/donors" element={<Private><Donors /></Private>} />
        <Route path="/inventory" element={<Private><Inventory /></Private>} />
        <Route path="/my-stock" element={<Private><HospitalStock /></Private>} />
        <Route path="/profile" element={<Private><Profile /></Private>} />
        <Route path="/admin" element={<AdminOnly><Admin /></AdminOnly>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function LangSwitch({ lang, setLang }) {
  return (
    <span className="lang-switch" role="group" aria-label="Language">
      <button
        type="button"
        className={`lang-opt ${lang === "en" ? "active" : ""}`}
        onClick={() => setLang("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={`lang-opt ${lang === "ne" ? "active" : ""}`}
        onClick={() => setLang("ne")}
      >
        ने
      </button>
    </span>
  );
}

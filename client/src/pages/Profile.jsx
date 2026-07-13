import { useState } from "react";
import api, { BLOOD_GROUPS } from "../api";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

// Two initials from a name, e.g. "Sundesh Sigdel" -> "SS"
function initials(name = "") {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

export default function Profile() {
  const { user, setUser, switchRole } = useAuth();
  const { t } = useLanguage();
  const isHospital = user.role === "hospital";
  const isDonor = user.role === "donor";
  const canSwitchMode = user.role === "donor" || user.role === "requester";
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleError, setRoleError] = useState("");

  const changeMode = async (next) => {
    if (next === user.role || roleBusy) return;
    setRoleError("");
    setRoleBusy(true);
    try {
      await switchRole(next);
    } catch (err) {
      setRoleError(err.response?.data?.message || t("profile.switchError"));
    } finally {
      setRoleBusy(false);
    }
  };

  const [form, setForm] = useState({
    name: user.name || "",
    phone: user.phone || "",
    city: user.city || "",
    bloodGroup: user.bloodGroup || "O+",
    hospitalName: user.hospitalName || "",
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [availBusy, setAvailBusy] = useState(false);

  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    setSaved(false);
  };

  // Name: letters and spaces only.
  const setName = (e) => {
    setForm({ ...form, name: e.target.value.replace(/[^A-Za-z\s]/g, "") });
    setSaved(false);
  };

  // Phone: digits only, capped at 10.
  const setPhone = (e) => {
    setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) });
    setSaved(false);
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    if (!/^[A-Za-z\s]+$/.test(form.name.trim())) {
      setError(t("register.invalidName"));
      return;
    }
    if (form.phone && !/^\d{10}$/.test(form.phone)) {
      setError(t("register.invalidPhone"));
      return;
    }
    setBusy(true);
    try {
      const res = await api.patch("/auth/profile", form);
      setUser(res.data.user);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || t("profile.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const toggleAvailability = async () => {
    setAvailBusy(true);
    try {
      const res = await api.patch("/auth/availability", {
        isAvailable: !user.isAvailable,
      });
      setUser(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || t("profile.availError"));
    } finally {
      setAvailBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t("profile.title")}</h1>
          <p className="muted">{t("profile.subtitle")}</p>
        </div>
      </div>

      {canSwitchMode && (
        <div className="card mode-card">
          <div className="mode-head">
            <div>
              <h3>{t("profile.accountMode")}</h3>
              <p className="muted">{t("profile.modeHint2")}</p>
            </div>
            <div
              className="mode-switch"
              role="group"
              aria-label={t("profile.switchGroupLabel")}
            >
              <button
                type="button"
                className={`mode-opt ${isDonor ? "active" : ""}`}
                aria-pressed={isDonor}
                disabled={roleBusy}
                onClick={() => changeMode("donor")}
              >
                {t("profile.donor")}
              </button>
              <button
                type="button"
                className={`mode-opt ${!isDonor ? "active" : ""}`}
                aria-pressed={!isDonor}
                disabled={roleBusy}
                onClick={() => changeMode("requester")}
              >
                {t("profile.requester")}
              </button>
            </div>
          </div>
          <p className="mode-hint muted">
            {isDonor ? t("profile.modeHintDonor") : t("profile.modeHintRequester")}
          </p>
          {roleError && <p className="error">{roleError}</p>}
        </div>
      )}

      <div className="profile-grid">
        {/* Identity card */}
        <aside className="card profile-id">
          <div className="avatar" aria-hidden="true">{initials(user.name)}</div>
          <h3>{user.name}</h3>
          <p className="muted">{user.email}</p>
          <span className={`role-chip role-${user.role}`}>{t(`role.${user.role}`)}</span>

          {!isHospital && (
            <div className="type-badge" style={{ marginTop: "0.4rem" }}>
              {user.bloodGroup}
            </div>
          )}

          {isDonor && (
            <button
              type="button"
              className={`avail-toggle ${user.isAvailable ? "on" : "off"}`}
              onClick={toggleAvailability}
              disabled={availBusy}
              aria-pressed={user.isAvailable}
            >
              <span className="status-dot" />
              {user.isAvailable ? t("profile.availableToDonate") : t("profile.notAvailable")}
            </button>
          )}
        </aside>

        {/* Edit form */}
        <form className="card profile-form" onSubmit={save}>
          <h3>{t("profile.editDetails")}</h3>

          <label>
            {isHospital ? t("profile.contactPerson") : t("profile.fullName")}
            <input
              required
              value={form.name}
              onChange={setName}
              pattern="[A-Za-z\s]+"
              title={t("register.invalidName")}
            />
          </label>

          {isHospital && (
            <label>
              {t("profile.hospitalName")}
              <input required value={form.hospitalName} onChange={set("hospitalName")} />
            </label>
          )}

          {!isHospital && (
            <label>
              {t("profile.bloodGroup")}
              <select value={form.bloodGroup} onChange={set("bloodGroup")}>
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg}>{bg}</option>
                ))}
              </select>
            </label>
          )}

          <div className="row">
            <label>
              {t("profile.city")}
              <input required value={form.city} onChange={set("city")} />
            </label>
            <label>
              {t("profile.phone")}
              <input
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={setPhone}
                pattern="\d{10}"
                maxLength={10}
                title={t("register.invalidPhone")}
                placeholder={t("profile.phonePlaceholder")}
              />
            </label>
          </div>

          <label>
            {t("profile.email")}
            <input value={user.email} disabled title={t("profile.emailTitle")} />
          </label>

          {error && <p className="error">{error}</p>}
          {saved && <p className="saved">{t("profile.savedNotice")}</p>}

          <button className="btn" disabled={busy}>
            {busy ? t("profile.saving") : t("profile.saveChanges")}
          </button>
        </form>
      </div>
    </div>
  );
}

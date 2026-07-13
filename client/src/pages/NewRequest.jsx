import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { BLOOD_GROUPS } from "../api";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import HospitalVerifyGate from "../components/HospitalVerifyGate.jsx";

export default function NewRequest() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    patientName: "",
    bloodGroup: "O+",
    unitsNeeded: 1,
    city: user.city || "",
    urgency: "standard",
    note: "",
  });
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.post("/requests", {
        ...form,
        unitsNeeded: Number(form.unitsNeeded),
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || t("newRequest.createError"));
    } finally {
      setBusy(false);
    }
  };

  if (user.role === "hospital" && user.status !== "active") {
    return <HospitalVerifyGate status={user.status} />;
  }

  if (result) {
    const count = result.matchedDonorCount;
    const bodyKey = count === 1 ? "newRequest.sentBody_one" : "newRequest.sentBody_other";
    return (
      <div className="page center">
        <div className="card auth">
          <h1>{t("newRequest.sentTitle")}</h1>
          <p>{t(bodyKey, { count, city: form.city })}</p>
          <button className="btn" onClick={() => navigate("/dashboard")}>
            {t("newRequest.backToDashboard")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page center">
      <form className="card auth" onSubmit={submit}>
        <h1>{t("newRequest.title")}</h1>
        <p className="muted">{t("newRequest.subtitle")}</p>
        <label>
          {t("newRequest.patientName")}
          <input required value={form.patientName} onChange={set("patientName")} />
        </label>
        <div className="row">
          <label>
            {t("newRequest.bloodGroupNeeded")}
            <select value={form.bloodGroup} onChange={set("bloodGroup")}>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg}>{bg}</option>
              ))}
            </select>
          </label>
          <label>
            {t("newRequest.units")}
            <input type="number" min={1} max={20} required value={form.unitsNeeded} onChange={set("unitsNeeded")} />
          </label>
        </div>
        <div className="row">
          <label>
            {t("newRequest.city")}
            <input required value={form.city} onChange={set("city")} />
          </label>
          <label>
            {t("newRequest.urgency")}
            <select value={form.urgency} onChange={set("urgency")}>
              <option value="standard">{t("urgency.standard")}</option>
              <option value="urgent">{t("urgency.urgent")}</option>
              <option value="critical">{t("urgency.critical")}</option>
            </select>
          </label>
        </div>
        <label>
          {t("newRequest.noteLabel")}
          <textarea
            rows={3}
            maxLength={500}
            value={form.note}
            onChange={set("note")}
            placeholder={t("newRequest.notePlaceholder")}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>
          {busy ? t("newRequest.submitting") : t("newRequest.submit")}
        </button>
      </form>
    </div>
  );
}

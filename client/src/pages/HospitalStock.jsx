import { useEffect, useState } from "react";
import api, { BLOOD_GROUPS } from "../api";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import HospitalVerifyGate from "../components/HospitalVerifyGate.jsx";

export default function HospitalStock() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [stock, setStock] = useState({});
  const [editing, setEditing] = useState("");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/inventory/mine")
      .then((res) => {
        const map = {};
        res.data.inventory.forEach((i) => (map[i.bloodGroup] = i.unitsAvailable));
        setStock(map);
      })
      .catch((err) => setError(err.response?.data?.message || t("hospitalStock.loadError")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (bg) => {
    setSaving(bg);
    setError("");
    try {
      await api.put("/inventory", {
        bloodGroup: bg,
        unitsAvailable: Number(stock[bg] ?? 0),
      });
      setEditing("");
    } catch (err) {
      setError(err.response?.data?.message || t("hospitalStock.saveError"));
    } finally {
      setSaving("");
    }
  };

  if (user.role !== "hospital") {
    return <div className="page center">{t("hospitalStock.onlyHospital")}</div>;
  }

  if (user.status !== "active") {
    return <HospitalVerifyGate status={user.status} />;
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>
            {user.hospitalName || user.name} {t("hospitalStock.titleSuffix")}
          </h1>
          <p className="muted">{t("hospitalStock.subtitle")}</p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="grid stock-grid">
        {BLOOD_GROUPS.map((bg) => (
          <div key={bg} className="card stock-card">
            <span className="type-badge">{bg}</span>
            {editing === bg ? (
              <>
                <input
                  type="number"
                  min={0}
                  value={stock[bg] ?? 0}
                  onChange={(e) => setStock({ ...stock, [bg]: e.target.value })}
                />
                <button className="btn small" onClick={() => save(bg)} disabled={saving === bg}>
                  {saving === bg ? t("hospitalStock.saving") : t("hospitalStock.save")}
                </button>
              </>
            ) : (
              <>
                <strong className="stock-value">
                  {stock[bg] ?? 0} <span className="muted">{t("hospitalStock.units")}</span>
                </strong>
                <button className="btn small ghost" onClick={() => setEditing(bg)}>
                  {t("hospitalStock.edit")}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

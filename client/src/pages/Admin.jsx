import { useCallback, useEffect, useState } from "react";
import api from "../api";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Admin() {
  const { t } = useLanguage();
  const TABS = [
    { key: "pending", label: t("admin.tabPending") },
    { key: "active", label: t("admin.tabVerified") },
    { key: "rejected", label: t("admin.tabRejected") },
  ];
  const [tab, setTab] = useState("pending");
  const [hospitals, setHospitals] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await api.get("/admin/hospitals", { params: { status: tab } });
      setHospitals(res.data.hospitals);
    } catch (err) {
      setError(err.response?.data?.message || t("admin.loadError"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id, status) => {
    setBusyId(id);
    setError("");
    try {
      await api.patch(`/admin/hospitals/${id}`, { status });
      // Drop it from the current list — it no longer belongs in this tab.
      setHospitals((hs) => hs.filter((h) => h.id !== id));
    } catch (err) {
      setError(err.response?.data?.message || t("admin.updateError"));
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t("admin.title")}</h1>
          <p className="muted">{t("admin.subtitle")}</p>
        </div>
      </div>

      <div className="admin-tabs">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            className={`mode-opt ${tab === tb.key ? "active" : ""}`}
            onClick={() => setTab(tb.key)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {hospitals.length === 0 ? (
        <div className="card empty">{t("admin.noneInTab", { status: TABS.find((tb) => tb.key === tab)?.label })}</div>
      ) : (
        <div className="grid">
          {hospitals.map((h) => (
            <article key={h.id} className="card hospital-card">
              <div>
                <h3>{h.hospitalName || h.name}</h3>
                <p className="muted">
                  {t("admin.contact", { name: h.name, city: h.city })}
                  {h.phone ? ` · ${h.phone}` : ""}
                </p>
                <p className="muted">{h.email}</p>
                <p className="license">
                  {t("admin.licenseLabel")} <strong>{h.licenseNo || t("common.dash")}</strong>
                </p>
                <p className="license">
                  {t("admin.documentLabel")}{" "}
                  {h.documentUrl ? (
                    <a href={h.documentUrl} target="_blank" rel="noreferrer">
                      {t("admin.viewDocument")}
                    </a>
                  ) : (
                    <span>{t("admin.noDocument")}</span>
                  )}
                </p>
              </div>
              <div className="hospital-actions">
                {tab !== "active" && (
                  <button
                    className="btn small"
                    disabled={busyId === h.id}
                    onClick={() => decide(h.id, "active")}
                  >
                    {t("admin.approve")}
                  </button>
                )}
                {tab !== "rejected" && (
                  <button
                    className="btn small ghost"
                    disabled={busyId === h.id}
                    onClick={() => decide(h.id, "rejected")}
                  >
                    {t("admin.reject")}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

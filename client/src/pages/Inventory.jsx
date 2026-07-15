import { useEffect, useState, useCallback, useMemo } from "react";
import api, { BLOOD_GROUPS } from "../api";
import { useLanguage } from "../context/LanguageContext.jsx";
import FindBloodTabs from "../components/FindBloodTabs.jsx";
import { getSocket } from "../socket";

export default function Inventory() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState([]);
  const [filters, setFilters] = useState({ bloodGroup: "", city: "" });
  const [openHospital, setOpenHospital] = useState("");
  const [error, setError] = useState("");

  // Group flat inventory rows into one entry per hospital.
  const hospitals = useMemo(() => {
    const map = new Map();
    for (const i of items) {
      const h = i.hospital;
      if (!h?._id) continue;
      if (!map.has(h._id)) map.set(h._id, { hospital: h, total: 0, rows: [] });
      const entry = map.get(h._id);
      entry.total += i.unitsAvailable;
      entry.rows.push(i);
    }
    return [...map.values()];
  }, [items]);

  const load = useCallback(async () => {
    try {
      const params = {};
      if (filters.bloodGroup) params.bloodGroup = filters.bloodGroup;
      if (filters.city) params.city = filters.city;
      const [inv, sum] = await Promise.all([
        api.get("/inventory", { params }),
        api.get("/inventory/summary"),
      ]);
      setItems(inv.data.inventory);
      setSummary(sum.data.summary);
    } catch (err) {
      setError(err.response?.data?.message || t("inventory.loadError"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    load();
    const socket = getSocket();
    socket.on("inventory:update", load); // stock changes appear live
    return () => socket.off("inventory:update", load);
  }, [load]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t("inventory.title")}</h1>
          <p className="muted">{t("inventory.subtitle")}</p>
        </div>
      </div>

      <FindBloodTabs />

      <div className="summary-strip">
        {BLOOD_GROUPS.map((bg) => {
          const s = summary.find((x) => x._id === bg);
          return (
            <div key={bg} className="summary-cell">
              <span className="type-badge small">{bg}</span>
              <strong>{s ? s.totalUnits : 0}</strong>
              <span className="muted">{t("inventory.units")}</span>
            </div>
          );
        })}
      </div>

      <div className="filters card">
        <label>
          {t("inventory.bloodGroup")}
          <select
            value={filters.bloodGroup}
            onChange={(e) => setFilters({ ...filters, bloodGroup: e.target.value })}
          >
            <option value="">{t("inventory.all")}</option>
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg}>{bg}</option>
            ))}
          </select>
        </label>
        <label>
          {t("inventory.city")}
          <input
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
            placeholder={t("inventory.cityPlaceholder")}
          />
        </label>
        <button className="btn" onClick={load}>
          {t("inventory.filter")}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="hospital-list">
        {hospitals.map(({ hospital: h, total, rows }) => {
          const open = openHospital === h._id;
          return (
            <div key={h._id} className="card hospital-item">
              <button
                className="hospital-head"
                onClick={() => setOpenHospital(open ? "" : h._id)}
                aria-expanded={open}
              >
                <span className="hospital-name">{h.hospitalName || h.name}</span>
                <span className="muted">{h.city}</span>
                <span className="hospital-total">
                  <strong>{total}</strong> {t("inventory.units")}
                </span>
                <span className="chevron">{open ? "▲" : "▼"}</span>
              </button>
              {open && (
                <div className="hospital-detail">
                  {rows.map((i) => (
                    <div key={i._id} className={`detail-cell ${i.unitsAvailable === 0 ? "out" : ""}`}>
                      <span className="type-badge small">{i.bloodGroup}</span>
                      <strong>{i.unitsAvailable}</strong>
                    </div>
                  ))}
                  <div className="hospital-contact muted">
                    {t("inventory.thContact")}: {h.phone || t("common.dash")}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {hospitals.length === 0 && <p className="muted">{t("inventory.noRecords")}</p>}
      </div>
    </div>
  );
}

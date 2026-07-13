import { useEffect, useState, useCallback } from "react";
import api, { BLOOD_GROUPS } from "../api";
import { useLanguage } from "../context/LanguageContext.jsx";
import FindBloodTabs from "../components/FindBloodTabs.jsx";
import { getSocket } from "../socket";

export default function Inventory() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState([]);
  const [filters, setFilters] = useState({ bloodGroup: "", city: "" });
  const [error, setError] = useState("");

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

      <table className="stock-table">
        <thead>
          <tr>
            <th>{t("inventory.thHospital")}</th>
            <th>{t("inventory.thCity")}</th>
            <th>{t("inventory.thBloodGroup")}</th>
            <th>{t("inventory.thUnits")}</th>
            <th>{t("inventory.thContact")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i._id} className={i.unitsAvailable === 0 ? "out" : ""}>
              <td>{i.hospital?.hospitalName || i.hospital?.name}</td>
              <td>{i.hospital?.city}</td>
              <td><span className="type-badge small">{i.bloodGroup}</span></td>
              <td><strong>{i.unitsAvailable}</strong></td>
              <td>{i.hospital?.phone || t("common.dash")}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">{t("inventory.noRecords")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

import { useEffect, useState } from "react";
import api, { BLOOD_GROUPS } from "../api";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import CallButton from "../components/CallButton.jsx";
import FindBloodTabs from "../components/FindBloodTabs.jsx";
import HospitalVerifyGate from "../components/HospitalVerifyGate.jsx";

export default function Donors() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isUnverifiedHospital = user.role === "hospital" && user.status !== "active";
  const [filters, setFilters] = useState({ bloodGroup: "", city: "" });
  const [donors, setDonors] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    if (isUnverifiedHospital) return;
    try {
      const params = {};
      if (filters.bloodGroup) params.bloodGroup = filters.bloodGroup;
      if (filters.city) params.city = filters.city;
      const res = await api.get("/donors", { params });
      setDonors(res.data.donors);
    } catch (err) {
      setError(err.response?.data?.message || t("donors.loadError"));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isUnverifiedHospital) {
    return <HospitalVerifyGate status={user.status} />;
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t("donors.title")}</h1>
          <p className="muted">{t("donors.subtitle")}</p>
        </div>
      </div>

      <FindBloodTabs />

      <div className="filters card">
        <label>
          {t("donors.bloodGroupNeeded")}
          <select
            value={filters.bloodGroup}
            onChange={(e) => setFilters({ ...filters, bloodGroup: e.target.value })}
          >
            <option value="">{t("donors.any")}</option>
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg}>{bg}</option>
            ))}
          </select>
        </label>
        <label>
          {t("donors.city")}
          <input
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
            placeholder={t("donors.cityPlaceholder")}
          />
        </label>
        <button className="btn" onClick={load}>
          {t("donors.search")}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {donors.length === 0 ? (
        <div className="card empty">{t("donors.empty")}</div>
      ) : (
        <div className="grid">
          {donors.map((d) => (
            <article key={d._id} className="card donor">
              <span className="type-badge">{d.bloodGroup}</span>
              <div>
                <h3>{d.name}</h3>
                <p className="muted">
                  {d.city} · {d.phone || t("common.noPhone")}
                </p>
              </div>
              <CallButton phone={d.phone} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

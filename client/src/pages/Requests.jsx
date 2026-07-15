import { useEffect, useState, useCallback } from "react";
import api, { BLOOD_GROUPS } from "../api";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import RequestCard from "../components/RequestCard.jsx";
import { getSocket } from "../socket";

// Lets donors browse every open request (not just their city matches on the
// dashboard) and accept from here. Reuses RequestCard + GET /requests.
export default function Requests() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [filters, setFilters] = useState({ bloodGroup: "", city: "" });
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const params = {};
      if (filters.bloodGroup) params.bloodGroup = filters.bloodGroup;
      if (filters.city) params.city = filters.city;
      const res = await api.get("/requests", { params });
      setRequests(res.data.requests);
    } catch (err) {
      setError(err.response?.data?.message || t("findRequests.loadError"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    load();
    const socket = getSocket();
    socket.on("feed:new-request", load);
    socket.on("feed:update", load);
    return () => {
      socket.off("feed:new-request", load);
      socket.off("feed:update", load);
    };
  }, [load]);

  const accept = async (id) => {
    try {
      await api.post(`/requests/${id}/accept`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || t("findRequests.acceptError"));
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t("findRequests.title")}</h1>
          <p className="muted">{t("findRequests.subtitle")}</p>
        </div>
      </div>

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

      {requests.length === 0 ? (
        <div className="card empty">{t("findRequests.empty")}</div>
      ) : (
        <div className="grid">
          {requests.map((r) => (
            <RequestCard
              key={r._id}
              request={r}
              role={user.role}
              currentUserId={user.id}
              viewerLastDonation={user.lastDonation}
              onAccept={accept}
              onStatus={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

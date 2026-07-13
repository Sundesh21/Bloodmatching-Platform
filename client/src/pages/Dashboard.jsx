import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { getSocket } from "../socket";
import RequestCard from "../components/RequestCard.jsx";
import HospitalVerifyGate from "../components/HospitalVerifyGate.jsx";

export default function Dashboard() {
  const { user, setUser } = useAuth();
  const { t } = useLanguage();
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");

  const isDonor = user.role === "donor";
  const isUnverifiedHospital = user.role === "hospital" && user.status !== "active";

  const load = useCallback(async () => {
    if (isUnverifiedHospital) return;
    try {
      const url = isDonor ? "/requests/for-me" : "/requests?mine=true";
      const res = await api.get(url);
      setRequests(res.data.requests);
    } catch (err) {
      setError(err.response?.data?.message || t("dashboard.loadError"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDonor, isUnverifiedHospital]);

  useEffect(() => {
    load();
    const socket = getSocket();
    // Any new request or update refreshes the list live.
    const refresh = () => load();
    socket.on("feed:new-request", refresh);
    socket.on("feed:update", refresh);
    socket.on("request:new", refresh);
    socket.on("request:accepted", refresh);
    return () => {
      socket.off("feed:new-request", refresh);
      socket.off("feed:update", refresh);
      socket.off("request:new", refresh);
      socket.off("request:accepted", refresh);
    };
  }, [load]);

  const accept = async (id) => {
    try {
      await api.post(`/requests/${id}/accept`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || t("dashboard.acceptError"));
    }
  };

  const setStatus = async (id, status) => {
    try {
      await api.patch(`/requests/${id}/status`, { status });
      load();
    } catch (err) {
      setError(err.response?.data?.message || t("dashboard.updateError"));
    }
  };

  const toggleAvailability = async () => {
    const res = await api.patch("/auth/availability", {
      isAvailable: !user.isAvailable,
    });
    setUser(res.data.user);
  };

  if (isUnverifiedHospital) {
    return <HospitalVerifyGate status={user.status} />;
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t("dashboard.hello", { name: user.name.split(" ")[0] })}</h1>
          <p className="muted">
            {isDonor
              ? t("dashboard.donorSubtitle", { bloodGroup: user.bloodGroup, city: user.city })
              : t("dashboard.requesterSubtitle")}
          </p>
        </div>
        {isDonor ? (
          <button className={`btn ${user.isAvailable ? "" : "ghost"}`} onClick={toggleAvailability}>
            {user.isAvailable ? t("dashboard.availableBtn") : t("dashboard.unavailableBtn")}
          </button>
        ) : (
          <Link to="/request" className="btn">
            {t("dashboard.newRequestBtn")}
          </Link>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {requests.length === 0 ? (
        <div className="card empty">
          {isDonor ? t("dashboard.emptyDonor") : t("dashboard.emptyRequester")}
        </div>
      ) : (
        <div className="grid">
          {requests.map((r) => (
            <RequestCard
              key={r._id}
              request={r}
              role={user.role}
              currentUserId={user.id}
              onAccept={accept}
              onStatus={setStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import CallButton from "./CallButton.jsx";
import DirectionsButton from "./DirectionsButton.jsx";
import { daysUntilEligible } from "../api";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function RequestCard({ request, role, currentUserId, viewerLastDonation, onAccept, onStatus }) {
  const { t } = useLanguage();
  const r = request;
  const isRequesterView = role !== "donor";
  const isOwnRequest = currentUserId && r.requester?._id === currentUserId;
  const alreadyAccepted = r.acceptedDonors?.some((a) => a.donor?._id === currentUserId);
  const waitDays = role === "donor" ? daysUntilEligible(viewerLastDonation) : 0;

  // Fulfilment confirmation: was it a donor here, or the requester/a friend?
  const [confirming, setConfirming] = useState(false);
  const [fulfilMode, setFulfilMode] = useState("donor"); // "donor" | "self"
  const [donated, setDonated] = useState([]);

  const toggleDonated = (id) =>
    setDonated((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  const startFulfil = () => {
    // No accepted donors — nobody here to credit, fulfil straight away.
    if (!r.acceptedDonors?.length) return onStatus(r._id, "fulfilled", []);
    setConfirming(true);
  };

  const confirmFulfil = () =>
    // "self" (me / a friend) credits no donor; "donor" credits the ticked ones.
    onStatus(r._id, "fulfilled", fulfilMode === "self" ? [] : donated);

  const pickingDonors = confirming && fulfilMode === "donor";

  return (
    <article className={`card request urgency-${r.urgency}`}>
      <div className="request-top">
        <span className="type-badge" aria-label={`Blood group ${r.bloodGroup}`}>
          {r.bloodGroup}
        </span>
        <div>
          <h3>{r.patientName}</h3>
          <p className="muted">
            {r.unitsNeeded} {r.unitsNeeded > 1 ? t("requestCard.units") : t("requestCard.unit")} · {r.city} ·{" "}
            <span className={`pill ${r.urgency}`}>{t(`urgency.${r.urgency}`)}</span>
          </p>
        </div>
        <span className={`status status-${r.status}`}>{t(`status.${r.status}`)}</span>
      </div>

      {r.note && <p className="note">{r.note}</p>}

      {confirming && (
        <div className="fulfil-mode">
          <label>
            <input
              type="radio"
              name={`fm-${r._id}`}
              checked={fulfilMode === "donor"}
              onChange={() => setFulfilMode("donor")}
            />{" "}
            {t("requestCard.fulfilByDonor")}
          </label>
          <label>
            <input
              type="radio"
              name={`fm-${r._id}`}
              checked={fulfilMode === "self"}
              onChange={() => setFulfilMode("self")}
            />{" "}
            {t("requestCard.fulfilBySelf")}
          </label>
        </div>
      )}

      {r.acceptedDonors?.length > 0 && (
        <div className="donor-list">
          <strong>{pickingDonors ? t("requestCard.whoDonated") : t("requestCard.acceptedDonors")}</strong>
          {r.acceptedDonors.map((a, i) => (
            <p key={i} className="donor-row">
              <span>
                {pickingDonors && (
                  <input
                    type="checkbox"
                    checked={donated.includes(a.donor?._id)}
                    onChange={() => toggleDonated(a.donor?._id)}
                  />
                )}{" "}
                {a.donor?.name} ({a.donor?.bloodGroup}) — {a.donor?.phone || t("common.noPhone")}
              </span>
              {!confirming && a.donor?._id !== currentUserId && (
                <>
                  <CallButton phone={a.donor?.phone} />
                  <DirectionsButton location={a.donor?.location} />
                </>
              )}
            </p>
          ))}
        </div>
      )}

      <div className="request-actions">
        {role === "donor" && !alreadyAccepted && (r.status === "open" || r.status === "matched") && (
          waitDays > 0 ? (
            <span className="pill muted">{t("requestCard.notEligible", { days: waitDays })}</span>
          ) : (
            <button className="btn small" onClick={() => onAccept(r._id)}>
              {t("requestCard.iCanDonate")}
            </button>
          )
        )}
        {isRequesterView && r.status !== "fulfilled" && r.status !== "cancelled" && (
          confirming ? (
            <>
              <button className="btn small" onClick={confirmFulfil}>
                {t("requestCard.confirmFulfilled")}
              </button>
              <button className="btn small ghost" onClick={() => setConfirming(false)}>
                {t("requestCard.cancel")}
              </button>
            </>
          ) : (
            <>
              <button className="btn small" onClick={startFulfil}>
                {t("requestCard.markFulfilled")}
              </button>
              <button className="btn small ghost" onClick={() => onStatus(r._id, "cancelled")}>
                {t("requestCard.cancel")}
              </button>
            </>
          )
        )}
        {role === "donor" && !isOwnRequest && (
          <>
            {r.requester?.phone && (
              <CallButton
                phone={r.requester.phone}
                label={t("requestCard.callRequester", {
                  name: r.requester.name || t("requestCard.requesterFallback"),
                })}
              />
            )}
            <DirectionsButton location={r.requester?.location} />
          </>
        )}
      </div>
    </article>
  );
}

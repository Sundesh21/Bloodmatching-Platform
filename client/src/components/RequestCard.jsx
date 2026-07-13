import CallButton from "./CallButton.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function RequestCard({ request, role, currentUserId, onAccept, onStatus }) {
  const { t } = useLanguage();
  const r = request;
  const isRequesterView = role !== "donor";
  const isOwnRequest = currentUserId && r.requester?._id === currentUserId;

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

      {r.acceptedDonors?.length > 0 && (
        <div className="donor-list">
          <strong>{t("requestCard.acceptedDonors")}</strong>
          {r.acceptedDonors.map((a, i) => (
            <p key={i} className="donor-row">
              <span>
                {a.donor?.name} ({a.donor?.bloodGroup}) — {a.donor?.phone || t("common.noPhone")}
              </span>
              <CallButton phone={a.donor?.phone} />
            </p>
          ))}
        </div>
      )}

      <div className="request-actions">
        {role === "donor" && (r.status === "open" || r.status === "matched") && (
          <button className="btn small" onClick={() => onAccept(r._id)}>
            {t("requestCard.iCanDonate")}
          </button>
        )}
        {isRequesterView && r.status !== "fulfilled" && r.status !== "cancelled" && (
          <>
            <button className="btn small" onClick={() => onStatus(r._id, "fulfilled")}>
              {t("requestCard.markFulfilled")}
            </button>
            <button className="btn small ghost" onClick={() => onStatus(r._id, "cancelled")}>
              {t("requestCard.cancel")}
            </button>
          </>
        )}
        {r.requester?.phone && role === "donor" && !isOwnRequest && (
          <CallButton
            phone={r.requester.phone}
            label={t("requestCard.callRequester", {
              name: r.requester.name || t("requestCard.requesterFallback"),
            })}
          />
        )}
      </div>
    </article>
  );
}

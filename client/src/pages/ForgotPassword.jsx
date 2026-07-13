import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";

// Single-page reset: email → OTP (with retry) → new password. The page never
// navigates away until the password is saved, then it sends you to login.
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [stage, setStage] = useState("email"); // email | otp | reset
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const requestOtp = async (e) => {
    e?.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setNotice(res.data.message);
      setStage("otp");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/auth/verify-otp", { email, otp });
      setNotice("");
      setStage("reset");
    } catch (err) {
      setError(err.response?.data?.message || "That code is wrong or expired. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setError("");
    if (pw.length < 6) return setError("Password must be at least 6 characters.");
    if (pw !== pw2) return setError("Passwords don't match.");
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { email, otp, newPassword: pw });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't reset password. Try again.");
      // A wrong/expired code sends you back to re-enter it.
      if (err.response?.status === 400) setStage("otp");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page center">
      <form
        className="card auth"
        onSubmit={stage === "email" ? requestOtp : stage === "otp" ? verifyOtp : savePassword}
      >
        <h1>Reset password</h1>

        {stage === "email" && (
          <>
            <p className="muted">Enter your account email and we'll send you a one-time code.</p>
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          </>
        )}

        {stage === "otp" && (
          <>
            <p className="muted">
              If the email address is valid you will have a One Time Password, via email, please
              type it below.
            </p>
            <label>
              One-time password
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </label>
            <button type="button" className="btn ghost small" onClick={requestOtp} disabled={busy}>
              Resend code
            </button>
          </>
        )}

        {stage === "reset" && (
          <>
            <p className="muted">Choose a new password (at least 6 characters).</p>
            <label>
              New password
              <input
                type="password"
                required
                minLength={6}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                required
                minLength={6}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
              />
            </label>
          </>
        )}

        {notice && <p className="muted">{notice}</p>}
        {error && <p className="error">{error}</p>}

        <button className="btn" disabled={busy}>
          {busy
            ? "Please wait…"
            : stage === "email"
            ? "Send code"
            : stage === "otp"
            ? "Verify code"
            : "Save new password"}
        </button>

        <p className="muted">
          <Link to="/login">Back to login</Link>
        </p>
      </form>
    </div>
  );
}

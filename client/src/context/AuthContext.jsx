import { createContext, useContext, useEffect, useState } from "react";
import api from "../api";
import { connectSocket, disconnectSocket } from "../socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("bl_token");
    if (!token) return setLoading(false);
    api
      .get("/auth/me")
      .then((res) => {
        setUser(res.data.user);
        connectSocket();
      })
      .catch(() => localStorage.removeItem("bl_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("bl_token", res.data.token);
    setUser(res.data.user);
    connectSocket();
  };

  const register = async (payload) => {
    const res = await api.post("/auth/register", payload);
    localStorage.setItem("bl_token", res.data.token);
    setUser(res.data.user);
    connectSocket();
  };

  const logout = () => {
    localStorage.removeItem("bl_token");
    setUser(null);
    disconnectSocket();
  };

  // Switch active mode (donor <-> requester) on the same account.
  const switchRole = async (role) => {
    const res = await api.patch("/auth/role", { role });
    localStorage.setItem("bl_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  return (
    <AuthContext.Provider
      value={{ user, setUser, login, register, logout, switchRole, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

import { createContext, useContext, useState, useEffect } from "react";
import { login as loginApi } from "../api/auth";

const AuthContext = createContext(null);

const TOKEN_KEY = "skillbridge_access_token";
const USER_KEY = "skillbridge_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On first load, restore the session from localStorage so a refresh
  // doesn't log the user out.
  useEffect(() => {
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedUser) setUser(JSON.parse(savedUser));
    setLoading(false);
  }, []);

  async function login(email, password) {
    const data = await loginApi({ email, password });
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }

  // Used right after signup, before the user has "logged in" through the
  // /auth/login endpoint — e.g. to store the freshly created user optimistically.
  function setSession(userObj, accessToken) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userObj));
    setUser(userObj);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

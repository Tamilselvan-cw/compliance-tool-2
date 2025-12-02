// src/guards/RequireAuth.tsx
import * as React from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import axios from "../api/axiosInstance";
import { getCookie, deleteCookie } from "../utils/cookies";

export default function RequireAuth() {
  const [state, setState] = React.useState<"checking" | "ok" | "no">("checking");
  const location = useLocation();

  React.useEffect(() => {
    const token = localStorage.getItem("access_token") || getCookie("access_token");
    if (!token) return setState("no");

    // If axios didn't have it yet (e.g., hard reload), set header
    if (!axios.defaults.headers.common["Authorization"]) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }

    axios
      .get("/auth/me")
      .then(() => setState("ok"))
      .catch(() => {
        // bad/expired token — clear both storage and cookies
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        deleteCookie("access_token");
        deleteCookie("refresh_token");
        setState("no");
      });
  }, []);

  if (state === "checking") {
    return <div className="p-8 text-center text-sm text-gray-500">Checking session…</div>;
  }

  if (state === "no") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

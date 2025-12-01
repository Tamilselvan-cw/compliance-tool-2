// src/api/axiosInstance.ts
import axios from "axios";
import { getCookie } from "../utils/cookies";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const axiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Restore token from localStorage OR cookie
const t = localStorage.getItem("access_token") || getCookie("access_token");
if (t) axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${t}`;

export default axiosInstance;

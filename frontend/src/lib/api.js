import axios from "axios";
import { useCallback } from "react";
import { useAuth } from "@clerk/react";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;
export const WS_BASE = BACKEND_URL.replace(/^http/, "ws");

export function useApi() {
  const { getToken } = useAuth();
  return useCallback(
    async (method, url, data, params) => {
      const token = await getToken();
      const res = await axios({ method, url: `${API}${url}`, data, params, headers: { Authorization: `Bearer ${token}` } });
      return res.data;
    },
    [getToken]
  );
}

export function errMsg(e) {
  const d = e?.response?.data?.detail;
  if (Array.isArray(d)) return d.map((x) => x.msg).join(", ");
  return d || e?.message || "Something went wrong";
}

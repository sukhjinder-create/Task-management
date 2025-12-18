import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useSuperadminAuth } from "../context/SuperadminAuthContext";

export default function SuperadminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { login } = useSuperadminAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/superadmin/login`, {
        email,
        password,
      });

      const { token, superadmin } = res.data || {};
      if (!token || !superadmin) {
        toast.error("Login failed");
        return;
      }

      // ✅ SINGLE SOURCE OF TRUTH
      login(superadmin, token);

      toast.success("Welcome, superadmin");
      navigate("/superadmin/workspaces", { replace: true });
    } catch (err) {
      console.error("Superadmin login error:", err);
      const msg = err.response?.data?.error || "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-4 text-center">
          Superadmin Login
        </h2>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm"
          >
            {loading ? "Signing in..." : "Sign in as Superadmin"}
          </button>
        </form>
      </div>
    </div>
  );
}

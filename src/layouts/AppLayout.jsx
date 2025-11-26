import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AppLayout({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex">
      <Sidebar />

      <div className="ml-60 w-full min-h-screen bg-slate-100">
        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex justify-end">
          <button
            onClick={logout}
            className="text-sm bg-red-100 text-red-600 px-4 py-1 rounded-lg hover:bg-red-200"
          >
            Logout
          </button>
        </header>

        {/* MAIN PAGE CONTENT */}
        <main className="px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

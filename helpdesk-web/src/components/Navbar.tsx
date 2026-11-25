import { Link, useNavigate } from "react-router-dom";
import { FiLifeBuoy, FiLogOut } from "react-icons/fi";
import toast from "react-hot-toast";
import { useAuth } from "../context/useAuth";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    toast.success("Logged out");
    navigate("/login");
  };

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold">
          <FiLifeBuoy /> Helpdesk
        </Link>
        {user && (
          <nav className="flex items-center gap-1">
            <Link to="/" className="btn-ghost">Home</Link>
            <Link to="/tickets" className="btn-ghost">{user.role === "ADMIN" ? "All tickets" : "My tickets"}</Link>
            <span className="mx-2 hidden text-sm sm:inline">
              {user.name} <span className="rounded bg-chip px-1.5 py-0.5 text-xs">{user.role}</span>
            </span>
            <button onClick={onLogout} className="btn-ghost"><FiLogOut /> Logout</button>
          </nav>
        )}
      </div>
    </header>
  );
}
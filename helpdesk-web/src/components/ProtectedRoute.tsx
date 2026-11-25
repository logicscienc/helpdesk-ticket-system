import { Navigate, Outlet } from "react-router-dom";
// import { useAuth } from "../context/AuthContext";
import { useAuth } from "../context/useAuth";
import type { Role } from "../types";

export default function ProtectedRoute({ role }: { role?: Role }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-center">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
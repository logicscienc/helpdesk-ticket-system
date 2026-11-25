import type { ReactNode } from "react";
import { FiLifeBuoy } from "react-icons/fi";

export default function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-hero-from to-hero-to p-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <FiLifeBuoy className="mx-auto mb-2 text-3xl" />
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-brand/70">Support Help</p>
        </div>
        {children}
      </div>
    </div>
  );
}
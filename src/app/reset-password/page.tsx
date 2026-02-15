import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen grid place-items-center text-slate-200">Loading...</main>}>
      <ResetPasswordClient />
    </Suspense>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";
import { LoginHeader } from "./login-header";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-2xl)",
          padding: 32,
        }}
      >
        <LoginHeader />
        <LoginForm />
      </div>
    </main>
  );
}

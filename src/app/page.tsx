import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const user = await getSession();
  if (!user) redirect("/login");
  redirect(user.role === "CUSTOMER" ? "/portal" : "/dashboard");
}

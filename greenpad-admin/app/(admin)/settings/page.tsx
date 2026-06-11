import { redirect } from "next/navigation";

export default function OldSettings() {
  redirect("/settings-config?tab=coins");
}

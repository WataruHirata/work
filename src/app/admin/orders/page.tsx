import { redirect } from "next/navigation";

export default function AdminOrdersRedirect() {
  redirect("/store/orders");
}

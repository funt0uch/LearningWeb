import { redirect } from "next/navigation";

/** 根路径进入展示首页 */
export default function RootPage() {
  redirect("/home");
}

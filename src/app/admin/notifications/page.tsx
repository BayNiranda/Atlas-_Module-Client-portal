import { requireStaff } from "@/lib/auth/guards";
import { NotificationList } from "@/components/notification-list";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function AdminNotifications() {
  await requireStaff();
  return <NotificationList />;
}

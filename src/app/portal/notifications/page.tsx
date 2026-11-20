import { requireClient } from "@/lib/auth/guards";
import { NotificationList } from "@/components/notification-list";

// Waits for the login check on the server before sending the page.
export const instant = false;

export default async function PortalNotifications() {
  await requireClient();
  return <NotificationList />;
}

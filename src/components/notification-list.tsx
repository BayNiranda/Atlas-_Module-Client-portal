import Link from "next/link";
import { listNotifications } from "@/modules/notifications/queries";
import { markNotificationsRead } from "@/modules/notifications/actions";
import { fmtDateTime } from "@/modules/inquiries/labels";

// Shared by the admin area and the client portal.
export async function NotificationList() {
  const items = await listNotifications();
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <>
      <div className="top">
        <div>
          <h1>Notifications</h1>
          <div className="sub">{unread ? `${unread} unread` : "All caught up"}</div>
        </div>
        {unread > 0 && (
          <form action={markNotificationsRead}>
            <button className="btn btn-o btn-sm" type="submit">Mark all as read</button>
          </form>
        )}
      </div>
      <div className="panel" style={{ maxWidth: 760 }}>
        {items.length ? (
          <ul className="notes" style={{ marginTop: 0 }}>
            {items.map((n) => (
              <li key={n.id} style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <b style={{ fontWeight: n.read_at ? 500 : 700 }}>
                    {!n.read_at && <span className="st gold" style={{ marginRight: 8 }}>New</span>}
                    {n.link ? <Link href={n.link}>{n.title}</Link> : n.title}
                  </b>
                  {n.body && <p>{n.body}</p>}
                  <small>{fmtDateTime(n.created_at)}</small>
                </div>
                {!n.read_at && (
                  <form action={markNotificationsRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <button className="btn btn-o btn-sm" type="submit">Mark read</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted" style={{ margin: 0 }}>No notifications yet.</p>
        )}
      </div>
    </>
  );
}

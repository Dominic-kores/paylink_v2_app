
import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNotifications } from "../context/NotificationContext";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    markAllRead
  } = useNotifications();

  return (
    <div className="notification-wrapper">
      <button
        className="bell-button"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications: ${unreadCount} unread`}
      >
        <Bell size={23} />

        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>

            <button
              className="text-button"
              onClick={markAllRead}
            >
              <CheckCheck size={16} />
              Mark all as read
            </button>
          </div>

          {notifications.length === 0 ? (
            <p className="empty-state">
              No notifications yet.
            </p>
          ) : (
            notifications.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className={
                  `notification-item ${!item.read ? "unread" : ""}`
                }
              >
                <strong>{item.title}</strong>
                <p>{item.message}</p>
                <small>
                  {new Date(item.createdAt).toLocaleString()}
                </small>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

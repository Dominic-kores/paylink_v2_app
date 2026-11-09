
import {
  createContext,
  useContext,
  useEffect,
  useState
} from "react";

import { get, patch } from "../api";
import { createSocket } from "../socket";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [toast, setToast] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("paylink_token");

    if (!token) return;

    let active = true;

    const load = async () => {
      try {
        const data = await get("/notifications");

        if (active) {
          setNotifications(data.notifications);
        }
      } catch (error) {
        console.error(error);
      }
    };

    load();

    const socket = createSocket(token);

    const register = () => {
      socket.emit("register-merchant");
    };

    const onNotification = (notification) => {
      setNotifications((current) => {
        if (current.some((n) => n.id === notification.id)) {
          return current;
        }
        return [notification, ...current];
      });

      setToast(notification);
      setRefreshKey((key) => key + 1);
    };

    socket.on("connect", register);
    socket.on("new-notification", onNotification);
    socket.on("payment-updated", () => {
      setRefreshKey((key) => key + 1);
    });

    return () => {
      active = false;
      socket.off("connect", register);
      socket.off("new-notification", onNotification);
      socket.disconnect();
    };
  }, []);

  // Automatically dismiss toast after 5 seconds.
  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [toast]);

  async function markAllRead() {
    await patch("/notifications/read-all");

    setNotifications((items) =>
      items.map((item) => ({
        ...item,
        read: true
      }))
    );
  }

  const unreadCount = notifications.filter(
    (item) => !item.read
  ).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        toast,
        setToast,
        markAllRead,
        refreshKey
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const value = useContext(NotificationContext);

  if (!value) {
    throw new Error(
      "useNotifications must be inside NotificationProvider"
    );
  }

  return value;
}

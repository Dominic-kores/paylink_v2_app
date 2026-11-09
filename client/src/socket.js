
import { io } from "socket.io-client";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export function createSocket(token = null) {
  return io(SERVER_URL, {
    autoConnect: true,
    transports: ["websocket", "polling"],
    auth: token ? { token } : {},
    reconnection: true,
    reconnectionAttempts: 10
  });
}

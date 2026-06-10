import { logger } from "../utils/logger";

const BASE_URL = "/v1";

function getHeaders(user) {
  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": "Bearer mock-token-2315000174",
  };
  
  if (user) {
    headers["X-User-Id"] = user.id;
    headers["X-User-Role"] = user.role;
    if (user.department) {
      headers["X-Department"] = user.department;
    }
    if (user.year) {
      headers["X-Year"] = String(user.year);
    }
  }
  
  return headers;
}

export const api = {
  async fetchNotifications(user, { page = 1, limit = 20, type = "", isRead = "", sort = "-createdAt", cursor = "" } = {}) {
    const params = new URLSearchParams();
    if (cursor) {
      params.append("cursor", cursor);
      params.append("limit", String(limit));
      params.append("sort", sort);
    } else {
      params.append("page", String(page));
      params.append("limit", String(limit));
      params.append("sort", sort);
    }
    if (type) {
      params.append("type", type);
    }
    if (isRead !== "") {
      params.append("isRead", String(isRead));
    }

    const url = `${BASE_URL}/notifications?${params.toString()}`;
    logger.info("API Request: Fetch Notifications", { url, user: user?.id });

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(user),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      logger.info("API Success: Fetch Notifications", { count: result?.data?.length });
      return result;
    } catch (error) {
      logger.error("API Error: Fetch Notifications", error, { url });
      throw error;
    }
  },

  async markAsRead(user, notificationId) {
    const url = `${BASE_URL}/notifications/${notificationId}/read`;
    logger.info("API Request: Mark as Read", { notificationId, user: user?.id });

    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: getHeaders(user),
        body: JSON.stringify({ readAt: new Date().toISOString() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      logger.info("API Success: Mark as Read", { notificationId });
      return result;
    } catch (error) {
      logger.error("API Error: Mark as Read", error, { notificationId });
      throw error;
    }
  },

  async markAllAsRead(user, type = "") {
    const url = `${BASE_URL}/notifications/read-all`;
    logger.info("API Request: Mark All as Read", { type, user: user?.id });

    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: getHeaders(user),
        body: type ? JSON.stringify({ type }) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      logger.info("API Success: Mark All as Read", { count: result?.data?.markedReadCount });
      return result;
    } catch (error) {
      logger.error("API Error: Mark All as Read", error, { type });
      throw error;
    }
  },

  async createNotification(adminUser, notificationBody) {
    const url = `${BASE_URL}/notifications`;
    const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    logger.info("API Request: Create Notification", { body: notificationBody, admin: adminUser?.id });

    try {
      const headers = getHeaders(adminUser);
      headers["Idempotency-Key"] = idempotencyKey;

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(notificationBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      logger.info("API Success: Create Notification", { notificationId: result?.data?.id });
      return result;
    } catch (error) {
      logger.error("API Error: Create Notification", error);
      throw error;
    }
  },

  async deleteNotification(adminUser, notificationId) {
    const url = `${BASE_URL}/notifications/${notificationId}`;
    logger.info("API Request: Delete Notification", { notificationId, admin: adminUser?.id });

    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: getHeaders(adminUser),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      logger.info("API Success: Delete Notification", { notificationId });
      return result;
    } catch (error) {
      logger.error("API Error: Delete Notification", error, { notificationId });
      throw error;
    }
  },

  /**
   * Custom stream reader to connect to the Server-Sent Events (SSE) endpoint
   * using standard fetch so we can attach custom user authentication headers.
   */
  async connectStream(user, { onNotification, onConnected, onDisconnected }) {
    const url = `${BASE_URL}/notifications/stream`;
    logger.info("SSE Stream: Connecting...", { user: user?.id });

    let active = true;
    let abortController = new AbortController();

    const startStream = async () => {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: getHeaders(user),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`SSE stream failed with status: ${response.status}`);
        }

        if (onConnected) {
          onConnected();
        }
        logger.info("SSE Stream: Connected successfully", { user: user?.id });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (active) {
          const { value, done } = await reader.read();
          if (done) {
            logger.info("SSE Stream: Connection closed by server");
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEvent = "";
          let currentId = "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
              continue;
            }

            if (trimmed.startsWith("event:")) {
              currentEvent = trimmed.substring(6).trim();
            } else if (trimmed.startsWith("id:")) {
              currentId = trimmed.substring(3).trim();
            } else if (trimmed.startsWith("data:")) {
              const dataStr = trimmed.substring(5).trim();
              if (currentEvent === "notification.created") {
                try {
                  const notificationObj = JSON.parse(dataStr);
                  logger.info("SSE Stream: Received notification.created", { id: notificationObj.id });
                  onNotification(notificationObj);
                } catch (err) {
                  logger.error("SSE Stream: JSON Parse Error", err, { dataStr });
                }
              } else if (currentEvent === "connected") {
                logger.info("SSE Stream: Registration details received", { dataStr });
              }
              currentEvent = "";
              currentId = "";
            }
          }
        }
      } catch (err) {
        if (active && err.name !== "AbortError") {
          logger.error("SSE Stream: Connection Error", err);
          if (onDisconnected) {
            onDisconnected();
          }
          // Attempt reconnection after 5 seconds
          logger.warn("SSE Stream: Reconnecting in 5 seconds...");
          setTimeout(() => {
            if (active) {
              startStream();
            }
          }, 5000);
        }
      }
    };

    startStream();

    // Return disconnect cleanup function
    return () => {
      active = false;
      abortController.abort();
      logger.info("SSE Stream: Disconnected by client", { user: user?.id });
    };
  }
};

const API_URL = "http://4.224.186.213/evaluation-service/notifications";

export const notificationApi = {
  /**
   * Fetches paginated notifications, optionally filtered by type.
   * 
   * @param {Object} params
   * @param {number} params.page - Page number to request
   * @param {number} params.limit - Number of items to retrieve per page
   * @param {string} params.type - Filter by type ('Placement', 'Result', 'Event')
   */
  async fetchNotifications({ page = 1, limit = 10, type = "" } = {}) {
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("limit", String(limit));
    if (type) {
      params.append("notification_type", type);
    }

    const url = `${API_URL}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch notifications: HTTP ${response.status}`);
    }

    return response.json();
  }
};

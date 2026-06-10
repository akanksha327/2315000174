import { useState, useEffect, useCallback, useRef } from "react";
import { notificationApi } from "../services/notificationApi";
import { TopTenHeap, updateTopNotifications } from "../utils/topNotificationsHelper";
import { logger } from "../utils/logger";

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [topTen, setTopTen] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Pagination & Filter States
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [type, setType] = useState(""); // filter: "Placement", "Result", "Event"
  
  const [totalPages, setTotalPages] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Use a ref to persist the TopTenHeap instance across renders
  const heapRef = useRef(new TopTenHeap());

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      logger.info("Fetching Notifications from API", { page, limit, type });
      const result = await notificationApi.fetchNotifications({ page, limit, type });
      
      // Handle different API formats (Standard object with metadata or raw array)
      let list = [];
      let total = 0;
      
      if (Array.isArray(result)) {
        list = result;
        setHasNextPage(result.length === limit);
      } else if (result && typeof result === "object") {
        list = result.data || result.notifications || [];
        total = result.total || result.totalItems || 0;
        setTotalPages(Math.ceil(total / limit));
        setHasNextPage(result.hasNextPage ?? (list.length === limit));
      }

      setNotifications(list);

      // Feed fetched notifications into our Min-Heap to accumulate global Top 10
      list.forEach((item) => {
        heapRef.current.insert(item);
      });
      setTopTen(heapRef.current.getSortedItems());

    } catch (err) {
      logger.error("Error fetching notifications", err);
      setError(err.message || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [page, limit, type]);

  // Trigger fetch when parameters change
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Reset pagination on type filter change
  useEffect(() => {
    setPage(1);
  }, [type]);

  // Public method to handle a newly arrived notification efficiently using our O(1) utility function
  const addNewNotification = useCallback((newNtf) => {
    logger.info("Incremental update: New notification arrived", newNtf);
    
    // 1. Update main feed if the filter type matches (or if there is no filter)
    if (!type || newNtf.notification_type === type) {
      setNotifications((prev) => [newNtf, ...prev.slice(0, limit - 1)]);
    }

    // 2. Insert into the heap instance
    heapRef.current.insert(newNtf);

    // 3. Update the Top 10 list using our efficient O(1) update utility function
    setTopTen((prevTopTen) => updateTopNotifications(prevTopTen, newNtf));
  }, [type, limit]);

  return {
    notifications,
    topTen,
    loading,
    error,
    page,
    setPage,
    type,
    setType,
    totalPages,
    hasNextPage,
    addNewNotification,
    refetch: fetchNotifications,
  };
}

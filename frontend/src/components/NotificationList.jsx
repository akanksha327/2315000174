import React from "react";
import { Box, Typography } from "@mui/material";
import NotificationCard from "./NotificationCard";

export default function NotificationList({ notifications }) {
  if (!notifications || notifications.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: "center", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 2 }}>
        <Typography variant="h6" sx={{ color: "text.secondary", mb: 1 }}>
          No announcements found
        </Typography>
        <Typography variant="body2" sx={{ color: "text.disabled" }}>
          There are no notifications matching your active filter.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {notifications.map((notification) => (
        <NotificationCard key={notification.id} notification={notification} />
      ))}
    </Box>
  );
}

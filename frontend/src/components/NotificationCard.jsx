import React from "react";
import { Card, CardContent, Typography, Chip, Stack } from "@mui/material";
import { Work as WorkIcon, School as SchoolIcon, Event as EventIcon } from "@mui/icons-material";
import { getPriorityWeight } from "../utils/priorityHelper";

export default function NotificationCard({ notification }) {
  const { id, title, message, notification_type, timestamp } = notification;

  const getBadgeDetails = (type) => {
    const weight = getPriorityWeight(type);
    switch (weight) {
      case 3:
        return {
          label: `Placement (Priority: ${weight})`,
          color: "primary",
          icon: <WorkIcon fontSize="small" />,
        };
      case 2:
        return {
          label: `Result (Priority: ${weight})`,
          color: "secondary",
          icon: <SchoolIcon fontSize="small" />,
        };
      case 1:
        return {
          label: `Event (Priority: ${weight})`,
          color: "success",
          icon: <EventIcon fontSize="small" />,
        };
      default:
        return {
          label: `${type} (Priority: ${weight})`,
          color: "default",
          icon: <EventIcon fontSize="small" />,
        };
    }
  };

  const badge = getBadgeDetails(notification_type);

  return (
    <Card
      sx={{
        mb: 2,
        borderRadius: 2,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        background: "rgba(15, 17, 26, 0.6)",
        backdropFilter: "blur(8px)",
        transition: "transform 0.2s, box-shadow 0.2s",
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: "rgba(255, 255, 255, 0.15)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
        },
      }}
    >
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Chip
            icon={badge.icon}
            label={badge.label}
            color={badge.color}
            size="small"
            variant="outlined"
            sx={{ fontWeight: "bold", fontSize: "0.75rem" }}
          />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {new Date(timestamp).toLocaleString()}
          </Typography>
        </Stack>

        <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ fontSize: "1.1rem" }}>
          {title}
        </Typography>

        <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.6, mb: 1.5 }}>
          {message}
        </Typography>

        <Typography variant="caption" sx={{ color: "text.disabled", display: "block" }}>
          ID: {id}
        </Typography>
      </CardContent>
    </Card>
  );
}

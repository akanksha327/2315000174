import React from "react";
import { Box, Typography, List, ListItem, Divider, Chip, Stack } from "@mui/material";
import { Whatshot as HotIcon, Work as WorkIcon, School as SchoolIcon, Event as EventIcon } from "@mui/icons-material";
import { getPriorityWeight } from "../utils/priorityHelper";

export default function TopNotifications({ topNotifications }) {
  const getIcon = (type) => {
    const weight = getPriorityWeight(type);
    switch (weight) {
      case 3:
        return <WorkIcon fontSize="small" color="primary" />;
      case 2:
        return <SchoolIcon fontSize="small" color="secondary" />;
      case 1:
        return <EventIcon fontSize="small" color="success" />;
      default:
        return <EventIcon fontSize="small" />;
    }
  };

  const getPriorityColor = (type) => {
    const weight = getPriorityWeight(type);
    switch (weight) {
      case 3: return "primary";
      case 2: return "secondary";
      case 1: return "success";
      default: return "default";
    }
  };

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        background: "rgba(15, 17, 26, 0.5)",
        backdropFilter: "blur(12px)",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" mb={2}>
        <HotIcon sx={{ color: "#f59e0b" }} />
        <Typography variant="h6" fontWeight="bold" sx={{ fontSize: "1.1rem" }}>
          Priority Inbox (Top 10)
        </Typography>
      </Stack>
      <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.08)", mb: 2 }} />

      {topNotifications.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic", textAlign: "center", py: 4 }}>
          No announcements available.
        </Typography>
      ) : (
        <List disablePadding>
          {topNotifications.map((item, index) => {
            const weight = getPriorityWeight(item.notification_type || item.type);
            return (
              <React.Fragment key={item.id}>
                <ListItem
                  alignItems="flex-start"
                  disableGutters
                  sx={{
                    py: 1.5,
                    px: 1,
                    borderRadius: 1,
                    "&:hover": {
                      bgcolor: "rgba(255, 255, 255, 0.02)",
                    },
                    transition: "background-color 0.2s",
                  }}
                >
                  <Stack direction="column" spacing={0.8} width="100%">
                    <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                      <Stack direction="row" spacing={1} alignItems="center">
                        {getIcon(item.notification_type)}
                        <Typography variant="caption" fontWeight="bold" sx={{ color: "text.disabled", letterSpacing: 0.5 }}>
                          {item.notification_type?.toUpperCase()}
                        </Typography>
                      </Stack>
                      <Chip
                        label={`Weight: ${weight}`}
                        size="small"
                        color={getPriorityColor(item.notification_type)}
                        variant="outlined"
                        sx={{
                          height: 16,
                          fontSize: "8px",
                          fontWeight: "bold",
                        }}
                      />
                    </Box>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: "text.primary", lineHeight: 1.4 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.disabled" }}>
                      {new Date(item.timestamp).toLocaleString()}
                    </Typography>
                  </Stack>
                </ListItem>
                {index < topNotifications.length - 1 && (
                  <Divider component="li" sx={{ borderColor: "rgba(255, 255, 255, 0.04)" }} />
                )}
              </React.Fragment>
            );
          })}
        </List>
      )}
    </Box>
  );
}

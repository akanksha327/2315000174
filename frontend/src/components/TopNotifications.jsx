import React from "react";
import {
  Box,
  Typography,
  List,
  ListItem,
  Chip,
  Stack,
  Divider,
} from "@mui/material";
import {
  Whatshot as HotIcon,
  Work as WorkIcon,
  Event as EventIcon,
  School as SchoolIcon,
} from "@mui/icons-material";

export default function TopNotifications({ notifications }) {
  const getPriorityWeight = (type) => {
    switch (type) {
      case "PLACEMENT":
        return 3;
      case "RESULT":
        return 2;
      case "EVENT":
        return 1;
      default:
        return 0;
    }
  };

  const sorted = [...notifications]
    .map((n) => ({
      ...n,
      weight: getPriorityWeight(n.type),
    }))
    .sort((a, b) => {
      if (b.weight !== a.weight) {
        return b.weight - a.weight;
      }
      return new Date(b.publishedAt) - new Date(a.publishedAt);
    })
    .slice(0, 10);

  const getIcon = (type) => {
    switch (type) {
      case "PLACEMENT":
        return <WorkIcon fontSize="small" sx={{ color: "var(--color-placement)" }} />;
      case "EVENT":
        return <EventIcon fontSize="small" sx={{ color: "var(--color-event)" }} />;
      case "RESULT":
        return <SchoolIcon fontSize="small" sx={{ color: "var(--color-result)" }} />;
      default:
        return <EventIcon fontSize="small" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "LOW": return "var(--priority-low)";
      case "NORMAL": return "var(--priority-normal)";
      case "HIGH": return "var(--priority-high)";
      case "URGENT": return "var(--priority-urgent)";
      default: return "var(--text-secondary)";
    }
  };

  return (
    <Box className="glass-panel" sx={{ p: 2.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" mb={2}>
        <HotIcon sx={{ color: "#f59e0b" }} />
        <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "var(--font-family-display)" }}>
          Top Priority (Top 10)
        </Typography>
      </Stack>
      <Divider sx={{ borderColor: "var(--border-glass)", mb: 2 }} />

      {sorted.length === 0 ? (
        <Typography variant="body2" sx={{ color: "var(--text-secondary)", fontStyle: "italic", textAlign: "center", py: 4 }}>
          No priority notifications.
        </Typography>
      ) : (
        <List disablePadding>
          {sorted.map((item, index) => {
            const pColor = getPriorityColor(item.priority);
            return (
              <React.Fragment key={item.id}>
                <ListItem
                  alignItems="flex-start"
                  disableGutters
                  sx={{
                    py: 1.5,
                    px: 1,
                    borderRadius: 2,
                    "&:hover": {
                      bgcolor: "rgba(255, 255, 255, 0.02)",
                    },
                    transition: "background-color 0.2s",
                  }}
                >
                  <Stack direction="column" spacing={0.8} width="100%">
                    <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                      <Stack direction="row" spacing={1} alignItems="center">
                        {getIcon(item.type)}
                        <Typography variant="caption" fontWeight="bold" sx={{ color: "var(--text-muted)", letterSpacing: 0.5 }}>
                          {item.type}
                        </Typography>
                      </Stack>
                      <Chip
                        label={item.priority}
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: "8px",
                          fontWeight: "bold",
                          bgcolor: "transparent",
                          color: pColor,
                          border: `1px solid ${pColor}`,
                        }}
                      />
                    </Box>
                    <Typography
                      variant="body2"
                      fontWeight="bold"
                      sx={{
                        color: item.isRead ? "var(--text-secondary)" : "var(--text-primary)",
                        lineHeight: 1.4,
                      }}
                    >
                      {item.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "var(--text-muted)" }}>
                      {new Date(item.publishedAt).toLocaleString()}
                    </Typography>
                  </Stack>
                </ListItem>
                {index < sorted.length - 1 && (
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

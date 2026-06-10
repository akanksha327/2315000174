import React from "react";
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Box,
  IconButton,
  Grid,
  Tooltip,
} from "@mui/material";
import {
  Work as WorkIcon,
  Event as EventIcon,
  School as SchoolIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UnreadIcon,
  Delete as DeleteIcon,
  AccessTime as AccessTimeIcon,
  CalendarToday as DateIcon,
  Place as PlaceIcon,
} from "@mui/icons-material";

export default function NotificationCard({
  notification,
  onMarkAsRead,
  onDelete,
  isAdmin = false,
}) {
  const {
    id,
    type,
    title,
    message,
    priority,
    metadata = {},
    createdBy = {},
    publishedAt,
    isRead,
    expiresAt,
  } = notification;

  const getTypeConfig = (type) => {
    switch (type) {
      case "PLACEMENT":
        return {
          icon: <WorkIcon sx={{ color: "var(--color-placement)" }} />,
          borderClass: "placement-border",
          label: "Placement",
          color: "var(--color-placement)",
        };
      case "EVENT":
        return {
          icon: <EventIcon sx={{ color: "var(--color-event)" }} />,
          borderClass: "event-border",
          label: "Event",
          color: "var(--color-event)",
        };
      case "RESULT":
        return {
          icon: <SchoolIcon sx={{ color: "var(--color-result)" }} />,
          borderClass: "result-border",
          label: "Result",
          color: "var(--color-result)",
        };
      default:
        return {
          icon: <EventIcon />,
          borderClass: "",
          label: type,
          color: "var(--text-primary)",
        };
    }
  };

  const typeConfig = getTypeConfig(type);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "LOW":
        return "var(--priority-low)";
      case "NORMAL":
        return "var(--priority-normal)";
      case "HIGH":
        return "var(--priority-high)";
      case "URGENT":
        return "var(--priority-urgent)";
      default:
        return "var(--text-secondary)";
    }
  };

  const priorityColor = getPriorityColor(priority);

  const isExpiringSoon = () => {
    if (!expiresAt) return false;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffHours = (expiry - now) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours < 24;
  };

  return (
    <Card
      className={`glass-panel ${typeConfig.borderClass} hover-grow ${priority === "URGENT" ? "glow-urgent" : ""}`}
      sx={{
        mb: 2,
        overflow: "visible",
        position: "relative",
        background: isRead ? "rgba(15, 17, 26, 0.45) !important" : "var(--bg-glass) !important",
        opacity: isRead ? 0.85 : 1,
      }}
    >
      <CardContent sx={{ p: 3, "&:last-child": { pb: 2 } }}>
        {/* Header line */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1.5}>
            {typeConfig.icon}
            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: typeConfig.color, letterSpacing: 0.5 }}>
              {typeConfig.label.toUpperCase()}
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <Chip
              label={priority}
              size="small"
              sx={{
                bgcolor: "transparent",
                color: priorityColor,
                border: `1px solid ${priorityColor}`,
                fontWeight: "bold",
                fontSize: "10px",
                height: 20,
              }}
            />
            {isRead ? (
              <Tooltip title="Read">
                <CheckIcon sx={{ color: "var(--priority-low)", fontSize: 20 }} />
              </Tooltip>
            ) : (
              <Tooltip title="Unread">
                <UnreadIcon sx={{ color: "var(--priority-normal)", fontSize: 20 }} />
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Title */}
        <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ color: "var(--text-primary)", fontFamily: "var(--font-family-display)" }}>
          {title}
        </Typography>

        {/* Message */}
        <Typography variant="body2" sx={{ color: "var(--text-secondary)", mb: 2, lineHeight: 1.6 }}>
          {message}
        </Typography>

        {/* Metadata */}
        {Object.keys(metadata).length > 0 && (
          <Box
            sx={{
              p: 2,
              mb: 2,
              borderRadius: "10px",
              bgcolor: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.04)",
            }}
          >
            <Grid container spacing={1.5}>
              {metadata.companyName && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" sx={{ color: "var(--text-muted)", display: "block" }}>COMPANY</Typography>
                  <Typography variant="body2" fontWeight="medium">{metadata.companyName}</Typography>
                </Grid>
              )}
              {metadata.applicationDeadline && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" sx={{ color: "var(--text-muted)", display: "block" }}>APPLICATION DEADLINE</Typography>
                  <Typography variant="body2" fontWeight="medium" display="flex" alignItems="center" gap={0.5}>
                    <AccessTimeIcon fontSize="inherit" />
                    {new Date(metadata.applicationDeadline).toLocaleString()}
                  </Typography>
                </Grid>
              )}
              {metadata.eventDate && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" sx={{ color: "var(--text-muted)", display: "block" }}>EVENT DATE</Typography>
                  <Typography variant="body2" fontWeight="medium" display="flex" alignItems="center" gap={0.5}>
                    <DateIcon fontSize="inherit" />
                    {new Date(metadata.eventDate).toLocaleString()}
                  </Typography>
                </Grid>
              )}
              {metadata.venue && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" sx={{ color: "var(--text-muted)", display: "block" }}>VENUE</Typography>
                  <Typography variant="body2" fontWeight="medium" display="flex" alignItems="center" gap={0.5}>
                    <PlaceIcon fontSize="inherit" />
                    {metadata.venue}
                  </Typography>
                </Grid>
              )}
              {metadata.examSession && (
                <Grid item xs={12}>
                  <Typography variant="caption" sx={{ color: "var(--text-muted)", display: "block" }}>EXAM SESSION</Typography>
                  <Typography variant="body2" fontWeight="medium">{metadata.examSession}</Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        )}

        {/* Footer details */}
        <Box display="flex" flexDirection={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={1} mt={2} pt={1.5} sx={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <Typography variant="caption" sx={{ color: "var(--text-muted)" }}>
            Publisher: <strong style={{ color: "var(--text-secondary)" }}>{createdBy.role}</strong> ({createdBy.id})
          </Typography>
          <Typography variant="caption" sx={{ color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 0.5 }}>
            <DateIcon sx={{ fontSize: 12 }} />
            {new Date(publishedAt).toLocaleString()}
          </Typography>
        </Box>

        {isExpiringSoon() && (
          <Box sx={{ mt: 1.5, p: 0.5, borderRadius: 1, bgcolor: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)", display: "flex", justifyContent: "center" }}>
            <Typography variant="caption" fontWeight="bold" sx={{ color: "var(--priority-high)" }}>
              ⚠️ Expiring within 24 hours!
            </Typography>
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ px: 3, pb: 2, pt: 0, display: "flex", justifyContent: "flex-end", gap: 1 }}>
        {onMarkAsRead && !isRead && (
          <Button
            size="small"
            variant="text"
            onClick={() => onMarkAsRead(id)}
            sx={{
              color: "var(--color-placement)",
              fontWeight: "bold",
              "&:hover": { bgcolor: "var(--color-placement-bg)" },
            }}
          >
            Mark as Read
          </Button>
        )}
        {isAdmin && onDelete && (
          <IconButton
            size="small"
            color="error"
            onClick={() => onDelete(id)}
            sx={{
              borderRadius: 2,
              border: "1px solid rgba(239, 68, 68, 0.2)",
              "&:hover": { bgcolor: "rgba(239, 68, 68, 0.1)" },
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </CardActions>
    </Card>
  );
}

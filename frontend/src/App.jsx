import React, { useState, useEffect, useCallback } from "react";
import {
  Container,
  Grid,
  Box,
  Typography,
  AppBar,
  Toolbar,
  Button,
  Avatar,
  Menu,
  MenuItem,
  Stack,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Snackbar,
  Alert,
  CircularProgress,
  Pagination,
  Card,
  CardContent,
} from "@mui/material";
import {
  Campaign as CampaignIcon,
  AccountCircle as UserIcon,
  Add as AddIcon,
  FiberManualRecord as DotIcon,
  Check as CheckIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";

import { api } from "./services/api";
import { logger } from "./utils/logger";
import FilterBar from "./components/FilterBar";
import NotificationCard from "./components/NotificationCard";
import TopNotifications from "./components/TopNotifications";

const USERS = {
  STUDENT_1: {
    id: "stu_1001",
    fullName: "Student One",
    role: "STUDENT",
    department: "CSE",
    year: 4,
    avatar: "S1",
  },
  STUDENT_2: {
    id: "stu_1002",
    fullName: "Student Two",
    role: "STUDENT",
    department: "ECE",
    year: 3,
    avatar: "S2",
  },
  ADMIN: {
    id: "usr_admin_102",
    fullName: "Admin User",
    role: "PLACEMENT_OFFICER",
    department: null,
    year: null,
    avatar: "AD",
  },
};

export default function App() {
  // Authentication & User Identity State
  const [activeUser, setActiveUser] = useState(USERS.STUDENT_1);
  const [anchorEl, setAnchorEl] = useState(null);

  // Filter & Pagination State
  const [filterType, setFilterType] = useState("");
  const [filterIsRead, setFilterIsRead] = useState("");
  const [sort, setSort] = useState("-publishedAt");
  const [paginationMode, setPaginationMode] = useState("page"); // "page" or "cursor"
  
  // Standard Page Navigation
  const [currentPage, setCurrentPage] = useState(1);
  
  // Cursor Navigation
  const [currentCursor, setCurrentCursor] = useState("");
  const [cursorHistory, setCursorHistory] = useState([null]); // holds cursors for previous page seeks
  
  // Feed Data State
  const [notifications, setNotifications] = useState([]);
  const [topPriorityNotifications, setTopPriorityNotifications] = useState([]);
  const [paginationMeta, setPaginationMeta] = useState(null);
  
  // Loading & UX State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [streamStatus, setStreamStatus] = useState("disconnected"); // connecting, connected, disconnected
  
  // SSE Real-Time Alert Toast State
  const [toast, setToast] = useState({ open: false, message: "", notification: null });
  
  // Admin Creation Modal State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newNotification, setNewNotification] = useState({
    type: "PLACEMENT",
    title: "",
    message: "",
    priority: "NORMAL",
    audience: {
      scope: "ALL_STUDENTS",
      department: "",
      year: "",
    },
    metadata: {
      companyName: "",
      applicationDeadline: "",
      eventId: "",
      eventDate: "",
      venue: "",
      examSession: "",
    },
  });

  // Fetch the paginated feed
  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.fetchNotifications(activeUser, {
        page: currentPage,
        limit: 5, // Keep limit low to showcase pagination clearly
        type: filterType,
        isRead: filterIsRead,
        sort,
        cursor: paginationMode === "cursor" ? currentCursor : "",
      });

      if (response.success) {
        setNotifications(response.data);
        setPaginationMeta(response.pagination);
      } else {
        throw new Error(response.error?.message || "Failed to load notifications");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeUser, currentPage, filterType, filterIsRead, sort, paginationMode, currentCursor]);

  // Fetch a larger background pool to calculate the true Top 10 Priority Notifications
  const loadTopPriorityPool = useCallback(async () => {
    try {
      const response = await api.fetchNotifications(activeUser, {
        page: 1,
        limit: 50, // Larger size to ensure we capture the highest priority announcements
        type: "",
        isRead: "",
        sort: "-publishedAt",
      });

      if (response.success) {
        setTopPriorityNotifications(response.data);
      }
    } catch (err) {
      logger.error("Background loadTopPriorityPool failed", err);
    }
  }, [activeUser]);

  // Combined data loading hook
  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Reload background priority calculations on active user or filter criteria changes
  useEffect(() => {
    loadTopPriorityPool();
  }, [activeUser, loadTopPriorityPool]);

  // Real-Time SSE Stream Hook
  useEffect(() => {
    setStreamStatus("connecting");
    let cleanup = null;

    api.connectStream(activeUser, {
      onNotification: (newNtf) => {
        // Trigger a snackbar alert toast
        setToast({
          open: true,
          message: `New announcement: "${newNtf.title}"`,
          notification: newNtf,
        });

        // Trigger feed reload to fetch the latest notifications
        loadFeed();
        loadTopPriorityPool();
      },
      onConnected: () => {
        setStreamStatus("connected");
      },
      onDisconnected: () => {
        setStreamStatus("disconnected");
      },
    }).then((closeFn) => {
      cleanup = closeFn;
    });

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [activeUser, loadFeed, loadTopPriorityPool]);

  // Reset page numbers on query/identity switches
  useEffect(() => {
    setCurrentPage(1);
    setCurrentCursor("");
    setCursorHistory([null]);
  }, [filterType, filterIsRead, sort, paginationMode, activeUser]);

  // User Profile Menu Handlers
  const handleUserMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = (user) => {
    setAnchorEl(null);
    if (user && user.id !== activeUser.id) {
      setActiveUser(user);
      logger.info("Swapped active user session", { user: user.id });
    }
  };

  // Mark single notification as read
  const handleMarkAsRead = async (notificationId) => {
    try {
      await api.markAsRead(activeUser, notificationId);
      // Optimistically update the read status in state
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      loadTopPriorityPool();
    } catch (err) {
      setError(err.message);
    }
  };

  // Mark all filtered notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllAsRead(activeUser, filterType);
      loadFeed();
      loadTopPriorityPool();
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete notification (Admin only)
  const handleDeleteNotification = async (notificationId) => {
    try {
      await api.deleteNotification(activeUser, notificationId);
      // Remove or mark as deleted in the feed list
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      loadTopPriorityPool();
    } catch (err) {
      setError(err.message);
    }
  };

  // Create notification (Admin only)
  const handleCreateNotification = async () => {
    try {
      // Clean target audience inputs
      const audience = {
        scope: newNotification.audience.scope,
      };
      if (audience.scope === "DEPARTMENT") {
        audience.department = newNotification.audience.department;
        if (newNotification.audience.year) {
          audience.year = Number(newNotification.audience.year);
        }
      }

      // Filter empty metadata fields
      const metadata = {};
      Object.entries(newNotification.metadata).forEach(([k, v]) => {
        if (v) metadata[k] = v;
      });

      const body = {
        type: newNotification.type,
        title: newNotification.title,
        message: newNotification.message,
        priority: newNotification.priority,
        audience,
        metadata,
      };

      await api.createNotification(activeUser, body);
      setCreateDialogOpen(false);
      
      // Reset dialog form state
      setNewNotification({
        type: "PLACEMENT",
        title: "",
        message: "",
        priority: "NORMAL",
        audience: { scope: "ALL_STUDENTS", department: "", year: "" },
        metadata: { companyName: "", applicationDeadline: "", eventId: "", eventDate: "", venue: "", examSession: "" },
      });

      // Reload lists
      loadFeed();
      loadTopPriorityPool();
    } catch (err) {
      setError(err.message);
    }
  };

  // Standard Page Handler
  const handlePageChange = (event, val) => {
    setCurrentPage(val);
  };

  // Cursor Navigation Handlers
  const handleCursorNext = () => {
    if (paginationMeta?.nextCursor) {
      setCursorHistory((prev) => [...prev, currentCursor]);
      setCurrentCursor(paginationMeta.nextCursor);
    }
  };

  const handleCursorPrev = () => {
    if (cursorHistory.length > 1) {
      const prevHistory = [...cursorHistory];
      prevHistory.pop(); // remove current cursor location
      const prevCursor = prevHistory[prevHistory.length - 1];
      setCursorHistory(prevHistory);
      setCurrentCursor(prevCursor || "");
    }
  };

  const isAdminRole = activeUser.role === "PLACEMENT_OFFICER" || activeUser.role === "ADMIN";

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "var(--bg-primary)" }}>
      {/* Sleek top app bar with glassmorphic look */}
      <AppBar
        position="sticky"
        sx={{
          background: "rgba(8, 9, 13, 0.7)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-glass)",
          boxShadow: "none",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", px: { xs: 2, md: 4 } }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CampaignIcon sx={{ color: "var(--color-placement)", fontSize: 28 }} />
            <Typography
              variant="h6"
              fontWeight="800"
              className="gradient-text"
              sx={{
                fontFamily: "var(--font-family-display)",
                letterSpacing: 1,
              }}
            >
              CAMPUS NOTIFY
            </Typography>
          </Stack>

          <Stack direction="row" spacing={3} alignItems="center">
            {/* Real-time connection status indicator */}
            <Stack direction="row" spacing={1} alignItems="center">
              <DotIcon
                sx={{
                  fontSize: 12,
                  color:
                    streamStatus === "connected"
                      ? "var(--priority-low)"
                      : streamStatus === "connecting"
                      ? "var(--priority-high)"
                      : "var(--priority-urgent)",
                }}
              />
              <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: { xs: "none", sm: "block" } }}>
                {streamStatus === "connected" ? "LIVE STREAM ACTIVE" : streamStatus === "connecting" ? "CONNECTING..." : "DISCONNECTED"}
              </Typography>
            </Stack>

            {/* Profile Selection switcher */}
            <Button
              color="inherit"
              startIcon={<UserIcon />}
              onClick={handleUserMenuClick}
              sx={{
                bgcolor: "var(--bg-tertiary)",
                border: "1px solid var(--border-glass)",
                borderRadius: "20px",
                px: 2,
                textTransform: "none",
                "&:hover": { bgcolor: "rgba(255,255,255,0.06)" },
              }}
            >
              {activeUser.fullName}
            </Button>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => handleUserMenuClose(null)}>
              <MenuItem onClick={() => handleUserMenuClose(USERS.STUDENT_1)}>
                👨‍🎓 Student One (CSE, Year 4)
              </MenuItem>
              <MenuItem onClick={() => handleUserMenuClose(USERS.STUDENT_2)}>
                👩‍🎓 Student Two (ECE, Year 3)
              </MenuItem>
              <MenuItem onClick={() => handleUserMenuClose(USERS.ADMIN)}>
                🔑 Placement Officer (Admin role)
              </MenuItem>
            </Menu>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Main Layout Container */}
      <Container maxWidth="xl" sx={{ mt: 4, mb: 6, flexGrow: 1 }}>
        <Grid container spacing={3.5}>
          {/* Main Feed Container */}
          <Grid item xs={12} lg={8}>
            <FilterBar
              type={filterType}
              setType={setType}
              isRead={filterIsRead}
              setIsRead={setFilterIsRead}
              sort={sort}
              setSort={setSort}
              paginationMode={paginationMode}
              setPaginationMode={setPaginationMode}
            />

            {/* Error notifications */}
            {error && (
              <Alert severity="error" sx={{ mb: 3, bgcolor: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)" }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Actions Bar (Mark Read, Admin Create Notification) */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: "var(--font-family-display)" }}>
                Latest Announcements
              </Typography>

              <Stack direction="row" spacing={1.5}>
                <IconButton onClick={loadFeed} color="primary" sx={{ border: "1px solid var(--border-glass)" }}>
                  <RefreshIcon fontSize="small" />
                </IconButton>

                {!isAdminRole && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CheckIcon />}
                    onClick={handleMarkAllAsRead}
                    disabled={notifications.length === 0}
                    sx={{
                      borderColor: "var(--border-glass)",
                      color: "var(--text-secondary)",
                      textTransform: "none",
                      "&:hover": { borderColor: "rgba(255,255,255,0.15)" },
                    }}
                  >
                    Mark All Read
                  </Button>
                )}

                {isAdminRole && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateDialogOpen(true)}
                    sx={{
                      background: "var(--accent-gradient)",
                      color: "#fff",
                      fontWeight: "bold",
                      textTransform: "none",
                      boxShadow: "0 4px 14px 0 rgba(56, 189, 248, 0.3)",
                      "&:hover": { boxShadow: "0 6px 20px 0 rgba(56, 189, 248, 0.4)" },
                    }}
                  >
                    Publish Notification
                  </Button>
                )}
              </Stack>
            </Stack>

            {/* Main Cards List */}
            {loading ? (
              <Box display="flex" justifyContent="center" py={8}>
                <CircularProgress color="primary" />
              </Box>
            ) : notifications.length === 0 ? (
              <Card className="glass-panel" sx={{ py: 8 }}>
                <CardContent sx={{ textAlign: "center" }}>
                  <Typography variant="h6" sx={{ color: "var(--text-secondary)", mb: 1 }}>
                    All caught up!
                  </Typography>
                  <Typography variant="body2" sx={{ color: "var(--text-muted)" }}>
                    No announcements matching your criteria.
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <Box>
                {notifications.map((ntf) => (
                  <NotificationCard
                    key={ntf.id}
                    notification={ntf}
                    onMarkAsRead={!isAdminRole ? handleMarkAsRead : null}
                    onDelete={isAdminRole ? handleDeleteNotification : null}
                    isAdmin={isAdminRole}
                  />
                ))}

                {/* Pagination Selection */}
                {paginationMeta && (
                  <Box display="flex" justifyContent="center" mt={4}>
                    {paginationMode === "page" ? (
                      <Pagination
                        count={paginationMeta.totalPages}
                        page={currentPage}
                        onChange={handlePageChange}
                        color="primary"
                        sx={{
                          "& .MuiPaginationItem-root": {
                            color: "var(--text-secondary)",
                            borderColor: "var(--border-glass)",
                            "&.Mui-selected": {
                              color: "#fff",
                            },
                          },
                        }}
                      />
                    ) : (
                      <Stack direction="row" spacing={2}>
                        <Button
                          variant="outlined"
                          disabled={cursorHistory.length <= 1}
                          onClick={handleCursorPrev}
                          sx={{
                            borderColor: "var(--border-glass)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          Previous Page
                        </Button>
                        <Button
                          variant="outlined"
                          disabled={!paginationMeta.hasNextPage}
                          onClick={handleCursorNext}
                          sx={{
                            borderColor: "var(--border-glass)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          Next Page
                        </Button>
                      </Stack>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </Grid>

          {/* Right Sidebar: Top Priority Announcements */}
          <Grid item xs={12} lg={4}>
            <TopNotifications notifications={topPriorityNotifications} />
          </Grid>
        </Grid>
      </Container>

      {/* Admin Create Announcement Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          className: "glass-panel",
          sx: {
            bgcolor: "var(--bg-secondary)",
            backgroundImage: "none",
            border: "1px solid var(--border-glass)",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: "bold", fontFamily: "var(--font-family-display)" }}>
          Publish Announcement
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  value={newNotification.type}
                  label="Type"
                  onChange={(e) => setNewNotification((prev) => ({ ...prev, type: e.target.value }))}
                >
                  <MenuItem value="PLACEMENT">PLACEMENT</MenuItem>
                  <MenuItem value="EVENT">EVENT</MenuItem>
                  <MenuItem value="RESULT">RESULT</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select
                  value={newNotification.priority}
                  label="Priority"
                  onChange={(e) => setNewNotification((prev) => ({ ...prev, priority: e.target.value }))}
                >
                  <MenuItem value="LOW">LOW</MenuItem>
                  <MenuItem value="NORMAL">NORMAL</MenuItem>
                  <MenuItem value="HIGH">HIGH</MenuItem>
                  <MenuItem value="URGENT">URGENT</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Title"
                value={newNotification.title}
                onChange={(e) => setNewNotification((prev) => ({ ...prev, title: e.target.value }))}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Message"
                value={newNotification.message}
                onChange={(e) => setNewNotification((prev) => ({ ...prev, message: e.target.value }))}
              />
            </Grid>

            {/* Audience scope configuration */}
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Audience Scope</InputLabel>
                <Select
                  value={newNotification.audience.scope}
                  label="Audience Scope"
                  onChange={(e) =>
                    setNewNotification((prev) => ({
                      ...prev,
                      audience: { ...prev.audience, scope: e.target.value },
                    }))
                  }
                >
                  <MenuItem value="ALL_STUDENTS">ALL STUDENTS</MenuItem>
                  <MenuItem value="DEPARTMENT">DEPARTMENT</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {newNotification.audience.scope === "DEPARTMENT" && (
              <>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Department"
                    placeholder="e.g. CSE, ECE"
                    value={newNotification.audience.department}
                    onChange={(e) =>
                      setNewNotification((prev) => ({
                        ...prev,
                        audience: { ...prev.audience, department: e.target.value },
                      }))
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Academic Year"
                    placeholder="e.g. 1 to 5"
                    type="number"
                    value={newNotification.audience.year}
                    onChange={(e) =>
                      setNewNotification((prev) => ({
                        ...prev,
                        audience: { ...prev.audience, year: e.target.value },
                      }))
                    }
                  />
                </Grid>
              </>
            )}

            {/* Type Specific Metadata configuration */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ color: "var(--text-secondary)", mb: 1 }}>
                Additional Meta details
              </Typography>
              <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", mb: 2 }} />
            </Grid>

            {newNotification.type === "PLACEMENT" && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Company Name"
                    value={newNotification.metadata.companyName}
                    onChange={(e) =>
                      setNewNotification((prev) => ({
                        ...prev,
                        metadata: { ...prev.metadata, companyName: e.target.value },
                      }))
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Application Deadline"
                    placeholder="YYYY-MM-DDTHH:MM:SSZ"
                    value={newNotification.metadata.applicationDeadline}
                    onChange={(e) =>
                      setNewNotification((prev) => ({
                        ...prev,
                        metadata: { ...prev.metadata, applicationDeadline: e.target.value },
                      }))
                    }
                  />
                </Grid>
              </>
            )}

            {newNotification.type === "EVENT" && (
              <>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Event ID"
                    value={newNotification.metadata.eventId}
                    onChange={(e) =>
                      setNewNotification((prev) => ({
                        ...prev,
                        metadata: { ...prev.metadata, eventId: e.target.value },
                      }))
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Venue"
                    value={newNotification.metadata.venue}
                    onChange={(e) =>
                      setNewNotification((prev) => ({
                        ...prev,
                        metadata: { ...prev.metadata, venue: e.target.value },
                      }))
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Event Date"
                    placeholder="YYYY-MM-DDTHH:MM:SSZ"
                    value={newNotification.metadata.eventDate}
                    onChange={(e) =>
                      setNewNotification((prev) => ({
                        ...prev,
                        metadata: { ...prev.metadata, eventDate: e.target.value },
                      }))
                    }
                  />
                </Grid>
              </>
            )}

            {newNotification.type === "RESULT" && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Exam Session"
                  placeholder="e.g. APRIL_2026"
                  value={newNotification.metadata.examSession}
                  onChange={(e) =>
                    setNewNotification((prev) => ({
                      ...prev,
                      metadata: { ...prev.metadata, examSession: e.target.value },
                    }))
                  }
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ color: "var(--text-secondary)" }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateNotification}
            variant="contained"
            sx={{
              background: "var(--accent-gradient)",
              color: "#fff",
              fontWeight: "bold",
            }}
          >
            Publish
          </Button>
        </DialogActions>
      </Dialog>

      {/* Real-time SSE alert snackbar toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity="info"
          className="glass-panel"
          sx={{
            color: "var(--text-primary)",
            background: "rgba(15, 17, 26, 0.85) !important",
            border: "1px solid var(--border-glass) !important",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            "& .MuiAlert-icon": { color: "var(--color-placement)" },
          }}
          action={
            <Button
              color="primary"
              size="small"
              onClick={() => {
                setToast((prev) => ({ ...prev, open: false }));
              }}
            >
              Dismiss
            </Button>
          }
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

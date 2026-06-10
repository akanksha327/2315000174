import React from "react";
import { Container, Grid, Box, Typography, AppBar, Toolbar, Button, Stack, Alert, CircularProgress } from "@mui/material";
import { Campaign as CampaignIcon, AddAlert as AlertIcon, Refresh as RefreshIcon } from "@mui/icons-material";
import { useNotifications } from "./hooks/useNotifications";
import FilterBar from "./components/FilterBar";
import NotificationList from "./components/NotificationList";
import TopNotifications from "./components/TopNotifications";
import PaginationControls from "./components/PaginationControls";

export default function App() {
  const {
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
    refetch,
  } = useNotifications();

  // Handler to simulate a newly arrived notification in real-time
  const handleSimulateIncoming = () => {
    const types = ["Placement", "Result", "Event"];
    const randomType = types[Math.floor(Math.random() * types.length)];
    const idNum = Math.floor(Math.random() * 900000) + 100000;
    
    const mockNtf = {
      id: `sim_${idNum}`,
      title: `Simulated ${randomType} Announcement #${idNum}`,
      message: `This is a simulated real-time incoming notification regarding ${randomType.toLowerCase()} activities on campus.`,
      notification_type: randomType,
      timestamp: new Date().toISOString(),
    };

    addNewNotification(mockNtf);
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "var(--bg-primary)" }}>
      {/* AppBar Header */}
      <AppBar
        position="sticky"
        sx={{
          background: "rgba(8, 9, 13, 0.75)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border-glass)",
          boxShadow: "none",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", px: { xs: 2, md: 4 } }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CampaignIcon sx={{ color: "primary.main", fontSize: 28 }} />
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

          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="contained"
              size="small"
              startIcon={<AlertIcon />}
              onClick={handleSimulateIncoming}
              sx={{
                background: "var(--accent-gradient)",
                color: "#fff",
                fontWeight: "bold",
                textTransform: "none",
                borderRadius: "20px",
                px: 2.5,
                boxShadow: "0 4px 14px rgba(56, 189, 248, 0.3)",
                "&:hover": {
                  boxShadow: "0 6px 20px rgba(56, 189, 248, 0.4)",
                },
              }}
            >
              Simulate Incoming
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={refetch}
              sx={{
                borderColor: "var(--border-glass)",
                color: "text.secondary",
                borderRadius: "20px",
                textTransform: "none",
                "&:hover": {
                  borderColor: "rgba(255,255,255,0.15)",
                },
              }}
            >
              Refresh
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Main Content Layout */}
      <Container maxWidth="xl" sx={{ mt: 4, mb: 6, flexGrow: 1 }}>
        <Grid container spacing={3.5}>
          {/* Main Feed Column */}
          <Grid item xs={12} lg={8}>
            <FilterBar type={type} setType={setType} />

            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 3,
                  bgcolor: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "text.primary",
                }}
              >
                {error}
              </Alert>
            )}

            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, fontFamily: "var(--font-family-display)" }}>
              Announcements Feed
            </Typography>

            {loading ? (
              <Box display="flex" justifyContent="center" py={8}>
                <CircularProgress color="primary" />
              </Box>
            ) : (
              <Box>
                <NotificationList notifications={notifications} />
                <PaginationControls
                  page={page}
                  setPage={setPage}
                  totalPages={totalPages}
                  hasNextPage={hasNextPage}
                />
              </Box>
            )}
          </Grid>

          {/* Priority Inbox Column (Top 10) */}
          <Grid item xs={12} lg={4}>
            <TopNotifications topNotifications={topTen} />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

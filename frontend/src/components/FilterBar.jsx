import React from "react";
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  Select,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import {
  FilterList as FilterIcon,
  Sort as SortIcon,
  Visibility as VisibilityIcon,
  Speed as SpeedIcon,
} from "@mui/icons-material";

export default function FilterBar({
  type,
  setType,
  isRead,
  setIsRead,
  sort,
  setSort,
  paginationMode,
  setPaginationMode,
}) {
  return (
    <Box
      className="glass-panel"
      sx={{
        p: 2.5,
        mb: 3,
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        gap: 2.5,
        alignItems: { xs: "stretch", md: "center" },
        justifyContent: "space-between",
      }}
    >
      {/* Category Filter */}
      <Stack direction="column" spacing={0.8} sx={{ flex: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "var(--text-secondary)" }}>
          <FilterIcon fontSize="small" />
          <Typography variant="caption" fontWeight="bold">CATEGORY TYPE</Typography>
        </Stack>
        <ToggleButtonGroup
          value={type}
          exclusive
          onChange={(e, val) => val !== null && setType(val)}
          size="small"
          sx={{
            "& .MuiToggleButton-root": {
              color: "var(--text-secondary)",
              borderColor: "var(--border-glass)",
              px: { xs: 1.5, sm: 2 },
              "&.Mui-selected": {
                color: "#fff",
                background: "var(--accent-gradient)",
                border: "1px solid transparent",
              },
              "&:hover": {
                background: "rgba(255,255,255,0.04)",
              },
            },
          }}
        >
          <ToggleButton value="">All</ToggleButton>
          <ToggleButton value="PLACEMENT">Placements</ToggleButton>
          <ToggleButton value="EVENT">Events</ToggleButton>
          <ToggleButton value="RESULT">Results</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2.5}
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        {/* Read State Filter */}
        <Stack direction="column" spacing={0.8}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "var(--text-secondary)" }}>
            <VisibilityIcon fontSize="small" />
            <Typography variant="caption" fontWeight="bold">READ STATE</Typography>
          </Stack>
          <ToggleButtonGroup
            value={isRead}
            exclusive
            onChange={(e, val) => val !== null && setIsRead(val)}
            size="small"
            sx={{
              "& .MuiToggleButton-root": {
                color: "var(--text-secondary)",
                borderColor: "var(--border-glass)",
                "&.Mui-selected": {
                  color: "#fff",
                  background: "rgba(255,255,255,0.12)",
                },
                "&:hover": {
                  background: "rgba(255,255,255,0.04)",
                },
              },
            }}
          >
            <ToggleButton value="">All</ToggleButton>
            <ToggleButton value="false">Unread</ToggleButton>
            <ToggleButton value="true">Read</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {/* Sort Selection */}
        <Stack direction="column" spacing={0.8} sx={{ minWidth: 140 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "var(--text-secondary)", mb: 0.2 }}>
            <SortIcon fontSize="small" />
            <Typography variant="caption" fontWeight="bold">SORT BY</Typography>
          </Stack>
          <FormControl size="small" variant="outlined">
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              sx={{
                color: "var(--text-primary)",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "var(--border-glass)",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(255,255,255,0.15)",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#38bdf8",
                },
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                  },
                },
              }}
            >
              <MenuItem value="-publishedAt">Newest Published</MenuItem>
              <MenuItem value="publishedAt">Oldest Published</MenuItem>
              <MenuItem value="-createdAt">Newest Created</MenuItem>
              <MenuItem value="createdAt">Oldest Created</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        {/* Pagination Mode Selection */}
        <Stack direction="column" spacing={0.8} sx={{ minWidth: 140 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "var(--text-secondary)", mb: 0.2 }}>
            <SpeedIcon fontSize="small" />
            <Typography variant="caption" fontWeight="bold">PAGING STYLE</Typography>
          </Stack>
          <FormControl size="small">
            <Select
              value={paginationMode}
              onChange={(e) => setPaginationMode(e.target.value)}
              sx={{
                color: "var(--text-primary)",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "var(--border-glass)",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(255,255,255,0.15)",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#38bdf8",
                },
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                  },
                },
              }}
            >
              <MenuItem value="page">Offset Pages</MenuItem>
              <MenuItem value="cursor">Cursor Seeks</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Stack>
    </Box>
  );
}

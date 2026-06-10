import React from "react";
import { Box, ToggleButton, ToggleButtonGroup, Typography, Stack } from "@mui/material";
import { FilterList as FilterIcon } from "@mui/icons-material";

export default function FilterBar({ type, setType }) {
  const handleChange = (event, nextType) => {
    if (nextType !== null) {
      setType(nextType);
    }
  };

  return (
    <Box
      sx={{
        p: 2,
        mb: 3,
        borderRadius: 2,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        background: "rgba(15, 17, 26, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 2,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <FilterIcon sx={{ color: "text.secondary" }} />
        <Typography variant="body2" fontWeight="medium" sx={{ color: "text.primary" }}>
          Filter by Type:
        </Typography>
      </Stack>

      <ToggleButtonGroup
        value={type}
        exclusive
        onChange={handleChange}
        size="small"
        sx={{
          "& .MuiToggleButton-root": {
            color: "text.secondary",
            borderColor: "rgba(255, 255, 255, 0.08)",
            textTransform: "none",
            "&.Mui-selected": {
              color: "#fff",
              backgroundColor: "primary.main",
              "&:hover": {
                backgroundColor: "primary.dark",
              },
            },
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 0.04)",
            },
          },
        }}
      >
        <ToggleButton value="">All</ToggleButton>
        <ToggleButton value="Placement">Placement</ToggleButton>
        <ToggleButton value="Result">Result</ToggleButton>
        <ToggleButton value="Event">Event</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}

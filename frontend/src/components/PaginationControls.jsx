import React from "react";
import { Box, Button, Typography, Stack } from "@mui/material";
import { NavigateBefore as PrevIcon, NavigateNext as NextIcon } from "@mui/icons-material";

export default function PaginationControls({ page, setPage, totalPages, hasNextPage }) {
  const handlePrev = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNext = () => {
    if (hasNextPage || (totalPages && page < totalPages)) {
      setPage(page + 1);
    }
  };

  return (
    <Box display="flex" justifyContent="center" mt={4}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Button
          variant="outlined"
          startIcon={<PrevIcon />}
          onClick={handlePrev}
          disabled={page <= 1}
          sx={{
            borderColor: "rgba(255, 255, 255, 0.08)",
            color: "text.secondary",
            "&:hover": { borderColor: "rgba(255, 255, 255, 0.15)" },
          }}
        >
          Previous
        </Button>

        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Page {page} {totalPages ? `of ${totalPages}` : ""}
        </Typography>

        <Button
          variant="outlined"
          endIcon={<NextIcon />}
          onClick={handleNext}
          disabled={totalPages ? page >= totalPages : !hasNextPage}
          sx={{
            borderColor: "rgba(255, 255, 255, 0.08)",
            color: "text.secondary",
            "&:hover": { borderColor: "rgba(255, 255, 255, 0.15)" },
          }}
        >
          Next
        </Button>
      </Stack>
    </Box>
  );
}

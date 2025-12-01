// src/pages/organization/org/CompetencyMatrixWrapper.tsx
import * as React from "react";
import { Box, Paper, Typography } from "@mui/material";

export default function CompetencyMatrixWrapper(props: {
  children: React.ReactNode;
  minHeight?: number;
  minWidth?: number;
}) {
  const { children, minHeight = 420, minWidth = 900 } = props;

  return (
    <Paper
      elevation={0}
      sx={{
        width: "100%",
        overflow: "auto",
        maxHeight: "70vh",
        borderRadius: 2,
        p: 1,
        position: "relative",
        // helpful debug border while developing — remove later
        // border: "1px dashed rgba(0,0,0,0.04)",
      }}
    >
      <Box
        sx={{
          // inner area that actually holds the matrix content and gets min sizes
          minWidth: minWidth,
          minHeight: minHeight,
          width: "100%",
          // ensures content always visible and not collapsed
          display: "block",
          position: "relative",
        }}
      >
        {/* If children is falsy, show friendly hint */}
        {children ? (
          children
        ) : (
          <Box
            sx={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              px: 2,
            }}
          >
            <Typography color="text.secondary">
              No competency matrix data available.
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

// src/pages/organization/dashboard/HierarchyTile.tsx
import { Box, Paper, Typography } from "@mui/material";
import { FiLayers } from "react-icons/fi";

export default function HierarchyTile({ onClick }: { onClick?: () => void }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
        <Box sx={{ width: 48, height: 48, borderRadius: 1.5, display: "grid", placeItems: "center", background: "linear-gradient(180deg,#fff,#f5f5f5)" }}>
          <FiLayers size={20} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800 }}>Org Hierarchy</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>View & edit the organization hierarchy</Typography>
        </Box>
      </Box>
    </Paper>
  );
}

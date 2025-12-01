// src/components/layout/ContentSkeleton.tsx
import { Box, Skeleton } from "@mui/material";

export default function ContentSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    
<Box sx={{ display: "flex", flexDirection: "column", flex: 1, width: "100%", minWidth: 0, p: 2 }}>

      {[...Array(rows)].map((_, i) => (
        <Skeleton
          key={i}
          variant="rectangular"
          height={120}
          sx={{ mb: 2, borderRadius: 2 }}
        />
      ))}
    </Box>
  );
}

import * as React from "react";
import { Paper, Stack, Typography, Divider } from "@mui/material";

interface SectionProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export const SectionWrapper: React.FC<SectionProps> = ({
  title,
  children,
  action,
}) => (
  <Paper sx={{ p: 2, borderRadius: 2 }}>
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      mb={1}
    >
      <Typography variant="h6" fontWeight={700}>
        {title}
      </Typography>
      {action}
    </Stack>
    <Divider sx={{ mb: 2 }} />
    {children}
  </Paper>
);

import {
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Typography,
  Box,
  Avatar,
} from "@mui/material";
import { FiGrid } from "react-icons/fi";
import { cn } from "../../../components/lib/utils";

export type OrgItem = {
  id: string;
  name: string;
  adminEmail: string;
  createdAt: string; // ISO
  iconBg?: string;
};

export default function OrganizationCard({
  org,
  onClick,
}: {
  org: OrgItem;
  onClick?: () => void;
}) {
  return (
    <Card
      elevation={0}
      className={cn(
      // 👈 from global.css
        "transition-transform duration-200 hover:-translate-y-[2px] hover:shadow-lg"
      )}
      sx={{
        borderRadius: "var(--radius)",
    
        border: "1px solid var(--color-border)",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      <CardActionArea
        onClick={onClick}
        sx={{ borderRadius: "var(--radius)", overflow: "hidden" }}
      >
        <CardContent sx={{ p: 3 }}>
          {/* Header */}
          <Box className="flex items-center gap-3 mb-3">
            <Avatar
              variant="rounded"
              className="rounded-xl"
              sx={{
                width: 44,
                height: 44,
                color: "#fff",
                background: "linear-gradient(135deg, var(--logo-blue), var(--logo-green))",
                boxShadow: "0 6px 9px color-mix(in srgb, var(--logo-green) 90%, black)",
              }}
            >
              <FiGrid />
            </Avatar>
            <Box className="min-w-0">
              <Typography
                variant="h6"
                className="truncate"
                sx={{
                  fontWeight: 600,
                  color: "var(--color-text)",
                }}
              >
                {org.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: "var(--color-text-2)",
                }}
              >
                ID: {org.id}
              </Typography>
            </Box>
          </Box>

          {/* Body */}
          <Box className="space-y-1">
            <Typography
              variant="body2"
              sx={{
                color: "var(--color-text-2)",
              }}
              className="truncate"
            >
              Admin: {org.adminEmail}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "var(--color-text-2)",
              }}
            >
              Created: {new Date(org.createdAt).toLocaleDateString()}
            </Typography>
          </Box>

          {/* Footer chip */}
          <Box className="mt-4">
            <Chip
              size="small"
              label="Organization"
              sx={{
                borderRadius: "999px",
                fontWeight: 600,
                background:
                  "linear-gradient(90deg, color-mix(in srgb, var(--logo-green) 18%, white), color-mix(in srgb, var(--logo-blue) 10%, white))",
                color: "var(--color-primary)",
                border: "1px solid var(--color-border)",
              }}
            />
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

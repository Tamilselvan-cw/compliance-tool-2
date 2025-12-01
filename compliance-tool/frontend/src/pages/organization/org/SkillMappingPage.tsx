import { Box, Typography } from "@mui/material";
import { cn } from "../../../components/lib/utils";


export default function competencyMappingPage() {
return (
<Box className={cn("glass-card rounded-2xl p-4")}>
<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>competency Mapping</Typography>
<Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>
TODO: compare <code>role_competency_expectation</code> vs <code>employee_competency_rating</code> and show gaps.
</Typography>
</Box>
);
}
import { Container, Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const stats = [
  { value: "10,000+", label: "Employees Managed" },
  { value: "500+", label: "Organizations Trust Us" },
  { value: "95%", label: "Customer Satisfaction" },
  { value: "40%", label: "Faster competency Mapping" },
];

const StatsSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(8, 0),
  backgroundColor: theme.palette.primary.main,
  color: '#fff',
}));

const Stats = () => {
  return (
    <StatsSection>
      <Container maxWidth="lg">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 4 }}>
          {stats.map((stat, index) => (
            <Box key={index} sx={{ textAlign: 'center' }}>
                <Typography variant="h2" component="div" sx={{ fontWeight: 700, mb: 1 }}>
                  {stat.value}
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  {stat.label}
                </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </StatsSection>
  );
};

export default Stats;

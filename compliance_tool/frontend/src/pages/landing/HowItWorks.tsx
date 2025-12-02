import { Container, Box, Typography, CardContent } from '@mui/material';
import { Upload, Settings, People as PeopleIcon, BarChart } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { Card } from '@mui/material';

const StepCard = styled(Card)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  },
}));
const steps = [
  {
    icon: Upload,
    number: "01",
    title: "Import Your Team",
    description: "Upload employee data via Excel or integrate with your HRIS. Map employees to managers and organizational structure in minutes.",
  },
  {
    icon: Settings,
    number: "02",
    title: "Define Roles & competencys",
    description: "Create role definitions and assign expected competency levels. Set weights for critical competencies to focus development efforts.",
  },
  {
    icon: PeopleIcon,
    number: "03",
    title: "Collect Ratings",
    description: "Managers rate their teams on required competencys. Enable self-assessments for a complete 360° view of capabilities.",
  },
  {
    icon: BarChart,
    number: "04",
    title: "Analyze & Act",
    description: "Generate gap reports, identify training needs, and track progress over time. Export data for strategic workforce planning.",
  },
];

const HowItWorksSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(10, 0),
}));


const IconContainer = styled(Box)(({ theme }) => ({
  width: 64,
  height: 64,
  borderRadius: 24,
  backgroundColor: theme.palette.primary.main,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  boxShadow: '0 8px 16px rgba(66, 191, 97, 0.3)',
  flexShrink: 0,
}));

const StepNumber = styled(Typography)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(2),
  right: theme.spacing(3),
  fontSize: '4rem',
  fontWeight: 700,
  color: 'rgba(66, 191, 97, 0.1)',
  zIndex: 0,
}));

const HowItWorks = () => {
  return (
    <HowItWorksSection id="how-it-works">
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography variant="h2" gutterBottom>
            How{' '}
            <Typography component="span" variant="h2" color="primary">
              Tre Link
            </Typography>
            {' '}Works
          </Typography>
          <Typography variant="h5" color="text.secondary" sx={{ maxWidth: '800px', mx: 'auto', fontWeight: 400 }}>
            Get started in minutes with our streamlined four-step process
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 4 }}>
          {steps.map((step, index) => (
            <Box key={index}>
              <StepCard variant="outlined">
                <CardContent sx={{ p: 4, position: 'relative' }}>
                  <StepNumber>{step.number}</StepNumber>
                  
                  <Box sx={{ display: 'flex', gap: 3, position: 'relative', zIndex: 1 }}>
                    <IconContainer>
                      <step.icon sx={{ fontSize: 32 }} />
                    </IconContainer>

                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h4" gutterBottom>
                        {step.title}
                      </Typography>
                      <Typography variant="body1" color="text.secondary">
                        {step.description}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </StepCard>
            </Box>
          ))}
        </Box>
      </Container>
    </HowItWorksSection>
  );
};

export default HowItWorks;

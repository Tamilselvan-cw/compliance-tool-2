import { Container, Box, Typography, Card, CardContent } from '@mui/material';
import { 
  People, 
  TrackChanges, 
  BarChart, 
  Upload, 
  EmojiEvents, 
  TrendingUp,
  Security,
  FlashOn
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const features = [
  {
    icon: People,
    title: "Multi-Tenant Management",
    description: "Manage multiple organizations with role-based access for HR, managers, and employees",
  },
  {
    icon: TrackChanges,
    title: "Role-Based competency Mapping",
    description: "Define expected competency levels for each role and track actual competencies in real-time",
  },
  {
    icon: Upload,
    title: "Bulk Excel Import",
    description: "Upload thousands of employees with their competencys, managers, and roles in seconds",
  },
  {
    icon: BarChart,
    title: "Gap Analysis Reports",
    description: "Generate comprehensive reports showing competency gaps across departments, teams, and roles",
  },
  {
    icon: EmojiEvents,
    title: "360° competency Ratings",
    description: "Enable manager ratings and employee self-assessments for complete competency visibility",
  },
  {
    icon: TrendingUp,
    title: "Real-Time Dashboards",
    description: "Interactive analytics showing competency trends, top performers, and development needs",
  },
  {
    icon: Security,
    title: "Enterprise Security",
    description: "Bank-grade encryption, SSO support, and compliance with SOC 2 and GDPR standards",
  },
  {
    icon: FlashOn,
    title: "Automated Workflows",
    description: "Set up automatic notifications, reminders, and reports to keep teams aligned",
  },
];

const FeatureSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(10, 0),
  backgroundColor: 'rgba(0, 0, 0, 0.02)',
}));

const FeatureCard = styled(Card)(({ theme }) => ({
  height: '100%',
  transition: 'all 0.3s ease',
  '&:hover': {
    borderColor: theme.palette.primary.main,
  },
}));

const IconBox = styled(Box)(({ theme }) => ({
  width: 48,
  height: 48,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: 'rgba(66, 191, 97, 0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: theme.spacing(2),
  transition: 'background-color 0.3s',
  '&:hover': {
    backgroundColor: 'rgba(66, 191, 97, 0.2)',
  },
}));

const Features = () => {
  return (
    <FeatureSection id="features">
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography variant="h2" gutterBottom>
            Everything You Need to{' '}
            <Typography component="span" variant="h2" color="primary">
              Bridge competency Gaps
            </Typography>
          </Typography>
          <Typography variant="h5" color="text.secondary" sx={{ maxWidth: '800px', mx: 'auto', fontWeight: 400 }}>
            Powerful features designed to transform your workforce development and talent management strategy
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 3 }}>
          {features.map((feature, index) => (
            <Box key={index}>
              <FeatureCard variant="outlined">
                <CardContent sx={{ p: 3 }}>
                  <IconBox>
                    <feature.icon sx={{ fontSize: 28, color: 'primary.main' }} />
                  </IconBox>
                  <Typography variant="h6" gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Box>
          ))}
        </Box>
      </Container>
    </FeatureSection>
  );
};

export default Features;

import { Container, Box, Typography, Paper, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const benefits = [
  {
    category: "For HR Leaders",
    items: [
      "Identify competency gaps across the entire organization",
      "Make data-driven hiring and training decisions",
      "Track competency development over time with historical reports",
      "Align workforce capabilities with business goals",
    ],
  },
  {
    category: "For Managers",
    items: [
      "Quickly assess team capabilities and readiness",
      "Provide targeted coaching based on competency assessments",
      "Plan succession and identify high-potential talent",
      "Document performance reviews with objective data",
    ],
  },
  {
    category: "For Employees",
    items: [
      "Understand current competencys vs role expectations",
      "Get clarity on development opportunities",
      "Track personal growth and achievements",
      "Prepare for career advancement with clear goals",
    ],
  },
];

const BenefitsSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(10, 0),
  backgroundColor: '#007FBE',
  color: '#fff',
}));

const BenefitCard = styled(Paper)(({ theme }) => ({
  height: '100%',
  padding: theme.spacing(4),
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(66, 191, 97, 0.2)',
  transition: 'all 0.3s ease',
  '&:hover': {
    borderColor: 'rgba(66, 191, 97, 0.5)',
    transform: 'translateY(-4px)',
  },
}));

const Benefits = () => {
  return (
    <BenefitsSection id="benefits">
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography variant="h2" gutterBottom sx={{ color: '#fff' }}>
            Benefits for{' '}
            <Typography component="span" variant="h2" color="primary.main">
              Every Stakeholder
            </Typography>
          </Typography>
          <Typography variant="h5" sx={{ maxWidth: '800px', mx: 'auto', fontWeight: 400, opacity: 0.9 }}>
            Tre Link delivers value across your entire organization, from leadership to individual contributors
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 4 }}>
          {benefits.map((benefit, index) => (
            <Box key={index}>
              <BenefitCard elevation={0}>
                <Typography variant="h4" gutterBottom color="primary.main" sx={{ mb: 3 }}>
                  {benefit.category}
                </Typography>
                <List disablePadding>
                  {benefit.items.map((item, itemIndex) => (
                    <ListItem key={itemIndex} disablePadding sx={{ mb: 2 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Box sx={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          backgroundColor: 'rgba(66, 191, 97, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <CheckCircle sx={{ fontSize: 14, color: 'primary.main' }} />
                        </Box>
                      </ListItemIcon>
                      <ListItemText 
                        primary={item}
                        primaryTypographyProps={{
                          variant: 'body1',
                          sx: { color: '#fff' },
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </BenefitCard>
            </Box>
          ))}
        </Box>
      </Container>
    </BenefitsSection>
  );
};

export default Benefits;

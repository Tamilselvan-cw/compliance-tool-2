import { Container, Box, Typography, Button, Chip } from '@mui/material';
import { ArrowForward, PlayArrow } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const HeroSection = styled(Box)(({ theme }) => ({
  paddingTop: theme.spacing(16),
  paddingBottom: theme.spacing(10),
  position: 'relative',
  overflow: 'hidden',
  background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(66,191,97,0.05) 100%)',
}));

const HeroChip = styled(Chip)(({ theme }) => ({
  backgroundColor: 'rgba(66, 191, 97, 0.1)',
  border: '1px solid rgba(66, 191, 97, 0.2)',
  fontWeight: 500,
  '& .MuiChip-icon': {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: theme.palette.primary.main,
    animation: 'pulse 2s ease-in-out infinite',
  },
  '@keyframes pulse': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.5 },
  },
}));

const DashboardPreview = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(8),
  borderRadius: 24,
  overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
  border: '1px solid rgba(0, 0, 0, 0.1)',
  background: 'linear-gradient(135deg, rgba(66,191,97,0.1) 0%, rgba(0,127,190,0.1) 100%)',
}));

const Hero = () => {
  return (
    <HeroSection>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', maxWidth: '900px', mx: 'auto' }}>
          <HeroChip 
            icon={<Box />} 
            label="Transform Your Workforce competencys"
            sx={{ mb: 4 }}
          />

          <Typography variant="h1" gutterBottom sx={{ mb: 3 }}>
            Close competency Gaps with
            <Typography component="span" variant="h1" color="primary" display="block" sx={{ mt: 1 }}>
              Data-Driven Insights
            </Typography>
          </Typography>

          <Typography variant="h5" color="text.secondary" sx={{ mb: 5, maxWidth: '700px', mx: 'auto', fontWeight: 400 }}>
            Tre Link is the intelligent platform that maps employee competencys, identifies gaps, and accelerates team development—streamlining workforce planning and decision-making
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 3 }}>
            <Button 
              variant="contained" 
              size="large" 
              color="primary"
              endIcon={<ArrowForward />}
              sx={{ 
                px: 5,
                boxShadow: '0 8px 24px rgba(66, 191, 97, 0.3)',
              }}
            >
              Start Free Trial
            </Button>
            <Button 
              variant="outlined" 
              size="large"
              startIcon={<PlayArrow />}
              sx={{ px: 5 }}
            >
              Watch Demo
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary">
            No credit card required • 14-day free trial • Unlimited employees • Secure data encryption
          </Typography>
        </Box>

        <DashboardPreview>
          <Box sx={{ 
            aspectRatio: '16/9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 8,
          }}>
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{
                width: 80,
                height: 80,
                mx: 'auto',
                mb: 3,
                borderRadius: 3,
                background: 'rgba(66, 191, 97, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Box sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  backgroundColor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}>
                  <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </Box>
              </Box>
              <Typography variant="h4" gutterBottom>Dashboard Preview</Typography>
              <Typography variant="body1" color="text.secondary">
                Real-time competency gap analytics & insights
              </Typography>
            </Box>
          </Box>
        </DashboardPreview>
      </Container>
    </HeroSection>
  );
};

export default Hero;

import { Container, Box, Typography, Button } from '@mui/material';
import { ArrowForward } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const CTASection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(10, 0),
}));

const CTABox = styled(Box)(({ theme }) => ({
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 36,
  background: 'linear-gradient(135deg, #42BF61 0%, #2E8544 100%)',
  padding: theme.spacing(8),
  textAlign: 'center',
  color: '#fff',
  boxShadow: '0 20px 60px rgba(66, 191, 97, 0.3)',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -100,
    right: -100,
    width: 256,
    height: 256,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '50%',
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 192,
    height: 192,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '50%',
  },
}));

const CTA = () => {
  return (
    <CTASection>
      <Container maxWidth="md">
        <CTABox>
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Typography variant="h2" gutterBottom>
              Ready to Transform Your
              <Typography component="span" variant="h2" display="block" sx={{ mt: 1 }}>
                Workforce Development?
              </Typography>
            </Typography>
            
            <Typography variant="h5" sx={{ mb: 5, opacity: 0.95, fontWeight: 400, maxWidth: '700px', mx: 'auto' }}>
              Join hundreds of organizations using Tre Link to close competency gaps and build high-performing teams
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 4 }}>
              <Button 
                variant="contained" 
                size="large"
                endIcon={<ArrowForward />}
                sx={{ 
                  px: 5,
                  backgroundColor: '#007FBE',
                  '&:hover': {
                    backgroundColor: '#005885',
                  },
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                }}
              >
                Start Your Free Trial
              </Button>
              <Button 
                variant="outlined" 
                size="large"
                sx={{ 
                  px: 5,
                  borderColor: '#fff',
                  color: '#fff',
                  borderWidth: 2,
                  '&:hover': {
                    borderColor: '#fff',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 2,
                  },
                }}
              >
                Schedule a Demo
              </Button>
            </Box>

            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              ✓ No credit card required  ✓ 14-day free trial  ✓ Cancel anytime
            </Typography>
          </Box>
        </CTABox>
      </Container>
    </CTASection>
  );
};

export default CTA;

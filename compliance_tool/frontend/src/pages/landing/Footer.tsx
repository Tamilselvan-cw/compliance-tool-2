import { Container, Box, Typography, IconButton } from '@mui/material';
import { Link as LinkIcon, Email, LinkedIn, Twitter } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const FooterSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(8, 0, 4),
  backgroundColor: '#007FBE',
  color: '#fff',
  borderTop: '1px solid rgba(66, 191, 97, 0.1)',
}));

const FooterLink = styled('a')(({ theme }) => ({
  color: 'rgba(255, 255, 255, 0.7)',
  textDecoration: 'none',
  fontSize: '0.875rem',
  transition: 'color 0.2s',
  '&:hover': {
    color: theme.palette.primary.main,
  },
}));

const Logo = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(2),
}));

const LogoBox = styled(Box)(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.primary.main,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
}));

const Footer = () => {
  return (
    <FooterSection>
      <Container maxWidth="lg">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 4, mb: 4 }}>
          <Box>
            <Logo>
              <LogoBox>
                <LinkIcon sx={{ fontSize: 20 }} />
              </LogoBox>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                tre link
              </Typography>
            </Logo>
            <Typography variant="body2" sx={{ mb: 2, opacity: 0.7 }}>
              Intelligent competency gap analysis and workforce development platform
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton 
                size="small" 
                sx={{ 
                  backgroundColor: 'rgba(66, 191, 97, 0.1)',
                  '&:hover': { backgroundColor: 'rgba(66, 191, 97, 0.2)' },
                }}
              >
                <LinkedIn sx={{ fontSize: 18, color: '#fff' }} />
              </IconButton>
              <IconButton 
                size="small" 
                sx={{ 
                  backgroundColor: 'rgba(66, 191, 97, 0.1)',
                  '&:hover': { backgroundColor: 'rgba(66, 191, 97, 0.2)' },
                }}
              >
                <Twitter sx={{ fontSize: 18, color: '#fff' }} />
              </IconButton>
              <IconButton 
                size="small" 
                sx={{ 
                  backgroundColor: 'rgba(66, 191, 97, 0.1)',
                  '&:hover': { backgroundColor: 'rgba(66, 191, 97, 0.2)' },
                }}
              >
                <Email sx={{ fontSize: 18, color: '#fff' }} />
              </IconButton>
            </Box>
          </Box>
          <Box>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              Product
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FooterLink href="#">Features</FooterLink>
              <FooterLink href="#">Pricing</FooterLink>
              <FooterLink href="#">Security</FooterLink>
              <FooterLink href="#">Integrations</FooterLink>
            </Box>
          </Box>
          <Box>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              Company
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FooterLink href="#">About Us</FooterLink>
              <FooterLink href="#">Blog</FooterLink>
              <FooterLink href="#">Careers</FooterLink>
              <FooterLink href="#">Contact</FooterLink>
            </Box>
          </Box>
          <Box>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              Resources
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FooterLink href="#">Documentation</FooterLink>
              <FooterLink href="#">API Reference</FooterLink>
              <FooterLink href="#">Help Center</FooterLink>
              <FooterLink href="#">Community</FooterLink>
            </Box>
          </Box>
        </Box>

        <Box sx={{ 
          pt: 4, 
          borderTop: '1px solid rgba(66, 191, 97, 0.1)',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
        }}>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            © 2025 Tre Link. All rights reserved.
          </Typography>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <FooterLink href="#">Privacy Policy</FooterLink>
            <FooterLink href="#">Terms of Service</FooterLink>
            <FooterLink href="#">Cookie Policy</FooterLink>
          </Box>
        </Box>
      </Container>
    </FooterSection>
  );
};

export default Footer;

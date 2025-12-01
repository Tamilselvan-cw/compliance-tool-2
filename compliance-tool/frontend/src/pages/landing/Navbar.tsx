import { AppBar, Toolbar, Container, Box, Button, IconButton } from '@mui/material';
import { Link as LinkIcon, Menu as MenuIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  color: theme.palette.text.primary,
}));

const Logo = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  cursor: 'pointer',
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

const NavLink = styled('a')(({ theme }) => ({
  color: theme.palette.text.secondary,
  textDecoration: 'none',
  fontSize: '0.875rem',
  fontWeight: 500,
  transition: 'color 0.2s',
  '&:hover': {
    color: theme.palette.primary.main,
  },
}));

const Navbar = () => {
  return (
    <StyledAppBar position="fixed" elevation={0}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ justifyContent: 'space-between', py: 1 }}>
          <Logo>
            <LogoBox>
              <LinkIcon sx={{ fontSize: 20 }} />
            </LogoBox>
            <Box component="span" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
              tre link
            </Box>
          </Logo>

          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 4 }}>
            <NavLink href="#features">Features</NavLink>
            <NavLink href="#how-it-works">How It Works</NavLink>
            <NavLink href="#benefits">Benefits</NavLink>
            <NavLink href="#pricing">Pricing</NavLink>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
         <Button
  href="/login"
  variant="text"
  color="inherit"
  sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
>
  Login
</Button>
            <Button variant="contained" color="primary">
              Start Free Trial
            </Button>
            <IconButton sx={{ display: { xs: 'inline-flex', md: 'none' } }}>
              <MenuIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </Container>
    </StyledAppBar>
  );
};

export default Navbar;

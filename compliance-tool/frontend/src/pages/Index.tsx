import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import { theme } from '../theme/muiTheme';
import Navbar from "./landing/Navbar";
import Hero from "./landing/Hero";
import Stats from "./landing/Stats";
import Features from "./landing/Features";
import HowItWorks from "./landing/HowItWorks";
import Benefits from "./landing/Benefits";
import CTA from "./landing/CTA";
import Footer from "./landing/Footer";

const Index = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Navbar />
        <Hero />
        <Stats />
        <Features />
        <HowItWorks />
        <Benefits />
        <CTA />
        <Footer />
      </Box>
    </ThemeProvider>
  );
};

export default Index;

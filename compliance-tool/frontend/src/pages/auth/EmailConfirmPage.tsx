// src/pages/auth/EmailConfirmPage.tsx
import React, { useEffect, useState } from "react";
import {
  useSearchParams,
  useLocation,
  useNavigate,
} from "react-router-dom";
import axiosInstance from "../../api/axiosInstance";
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Stack,
} from "@mui/material";

type Status = "loading" | "success" | "error";

const EmailConfirmPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const email = searchParams.get("email") || undefined;

    const hash = location.hash.startsWith("#")
      ? location.hash.substring(1)
      : location.hash;
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get("access_token");

    if (!accessToken) {
      setStatus("error");
      setErrorMessage(
        "We couldn't find a valid confirmation token. The link may be invalid or expired."
      );
      return;
    }

    setStatus("loading");
    axiosInstance
      .get("/auth/confirm", {
        params: {
          access_token: accessToken,
          email,
        },
      })
      .then(() => {
        setStatus("success");
        window.history.replaceState(
          null,
          "",
          location.pathname + location.search
        );
      })
      .catch((err) => {
        console.error("Email confirm failed", err);
        setStatus("error");
        setErrorMessage(
          "Email confirmation failed or link expired. Please request a new link."
        );
      });
  }, [searchParams, location]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "rgba(15,23,42,0.04)", // light background
        p: 2,
      }}
    >
      <Paper
        elevation={4}
        sx={{
          maxWidth: 420,
          width: "100%",
          borderRadius: 3,
          p: 4,
          textAlign: "center",
        }}
      >
        <Stack spacing={2} alignItems="center">
          {/* Icon / state */}
          {status === "loading" && (
            <CircularProgress size={32} />
          )}

          {status === "success" && (
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(34,197,94,0.12)",
                fontSize: 32,
              }}
            >
              ✅
            </Box>
          )}

          {status === "error" && (
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(248,113,113,0.12)",
                fontSize: 32,
              }}
            >
              ⚠️
            </Box>
          )}

          {/* Title */}
          <Typography variant="h5" fontWeight={700}>
            {status === "loading"
              ? "Confirming your email"
              : status === "success"
              ? "Email confirmed"
              : "Verification issue"}
          </Typography>

          {/* Description */}
          {status === "loading" && (
            <Typography variant="body2" color="text.secondary">
              Please wait while we verify your email address...
            </Typography>
          )}

          {status === "error" && (
            <Typography variant="body2" color="text.secondary">
              {errorMessage || "Email confirmation failed or link expired."}
            </Typography>
          )}

          {status === "success" && (
            <Typography variant="body2" color="text.secondary">
              Your email has been verified successfully. Credentials sent to your mail. You can now log in to your account.
            </Typography>
          )}

          {/* Actions */}
          {status !== "loading" && (
            <Box mt={1}>
              <Button
                variant="contained"
                onClick={() => navigate("/login")}
              >
                Go to Login
              </Button>
            </Box>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};

export default EmailConfirmPage;

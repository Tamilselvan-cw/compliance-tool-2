import * as React from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Avatar,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { FiLogIn } from "react-icons/fi";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../../src/api/axiosInstance";
import { toast } from "../../components/hooks/use-toast";
import { cn } from "../../components/lib/utils";

// 1) Extend types
type MeResponse = {
  user_id: string;
  email: string;
  full_name?: string | null;
  role: "superadmin" | "org_admin" | "manager" | "staff" | "user";
  permissions: string[];
  status: "active" | "pending" | "disabled" | string;
  organization_id?: string | null;
};

type LoginResponse = {
  access_token: string;
  refresh_token?: string | null;
  user_id: string;
  email: string;
  role: "superadmin" | "org_admin" | "manager" | "staff" | "user";
  permissions: string[];
  organization_id?: string | null;
};

// 🔹 NEW: map backend roles -> frontend “employee role”
type AppRole = "admin" | "hr" | "manager" | "employee";

function mapBackendRoleToAppRole(
  backendRole: LoginResponse["role"] | MeResponse["role"]
): AppRole {
  switch (backendRole) {
    case "superadmin":
      return "admin";    // global admin
    case "org_admin":
      return "hr";       // org-level HR/admin
    case "manager":
      return "manager";
    default:
      // "staff" | "user" or anything else => treated as normal employee
      return "employee";
  }
}

export default function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [logoOk, setLogoOk] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // 2) Let redirect accept orgId
  const redirectByRole = React.useCallback(
    (role: LoginResponse["role"], orgId?: string | null) => {
      switch (role) {
        case "superadmin":
          nav("/organizations", { replace: true });
          break;
        case "org_admin":
          nav(
            orgId ? `/org/${orgId}/dashboard` : "/organization/dashboard",
            { replace: true }
          );
          break;
        case "manager":
          nav("/dashboard", { replace: true });
          break;
        case "staff":
          nav("/dashboard", { replace: true });
          break;
        default:
          nav("/", { replace: true });
      }
    },
    [nav]
  );

  // 3) Hydrate from /auth/me and return both role + orgId
  const hydrateFromMe = React.useCallback(
    async (loginRole: LoginResponse["role"], loginOrgId?: string | null) => {
      try {
        const me = await axiosInstance.get<MeResponse>("/auth/me");
        const u = me.data;

        // save raw user
        localStorage.setItem(
          "user",
          JSON.stringify({ id: u.user_id, email: u.email, role: u.role })
        );
        localStorage.setItem("permissions", JSON.stringify(u.permissions || []));
        if (u.organization_id) {
          localStorage.setItem("organization_id", u.organization_id);
        }

        // 🔹 NEW: save normalized employee app role
        const appRole = mapBackendRoleToAppRole(u.role);
        localStorage.setItem("app_role", appRole);

        return {
          role: u.role ?? loginRole,
          orgId: u.organization_id ?? loginOrgId ?? null,
        };
      } catch (err: any) {
        const status = err?.response?.status;
        const refresh = localStorage.getItem("refresh_token");
        if (status === 401 && refresh) {
          try {
            const { data } = await axiosInstance.post<{ access_token: string }>(
              "/auth/refresh",
              { refresh_token: refresh }
            );
            const newTok = data?.access_token;
            if (newTok) {
              localStorage.setItem("access_token", newTok);
              axiosInstance.defaults.headers.common["Authorization"] =
                `Bearer ${newTok}`;
              const me2 = await axiosInstance.get<MeResponse>("/auth/me");
              const u2 = me2.data;

              localStorage.setItem(
                "user",
                JSON.stringify({
                  id: u2.user_id,
                  email: u2.email,
                  role: u2.role,
                })
              );
              localStorage.setItem(
                "permissions",
                JSON.stringify(u2.permissions || [])
              );
              if (u2.organization_id) {
                localStorage.setItem("organization_id", u2.organization_id);
              }

              // 🔹 NEW: save normalized employee app role again after refresh
              const appRole2 = mapBackendRoleToAppRole(u2.role);
              localStorage.setItem("app_role", appRole2);

              return {
                role: u2.role ?? loginRole,
                orgId: u2.organization_id ?? loginOrgId ?? null,
              };
            }
          } catch {
            // ignore
          }
        }
        // fallback: still set something sane in localStorage
        const fallbackAppRole = mapBackendRoleToAppRole(loginRole);
        localStorage.setItem("app_role", fallbackAppRole);

        return { role: loginRole, orgId: loginOrgId ?? null };
      }
    },
    []
  );

  // 4) Use it in onSubmit
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();
    const pwd = password;

    if (!normalizedEmail || !pwd) {
      setFormError("Please enter both email and password.");
      return;
    }

    const emailOk = /\S+@\S+\.\S+/.test(normalizedEmail);
    if (!emailOk) {
      setFormError("Please enter a valid email address.");
      return;
    }

    setFormError(null);
    setLoading(true);

    try {
      const { data } = await axiosInstance.post<LoginResponse>("/auth/login", {
        email: normalizedEmail,
        password: pwd,
      });

      axiosInstance.defaults.headers.common["Authorization"] =
        `Bearer ${data.access_token}`;
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem(
        "user",
        JSON.stringify({ id: data.user_id, email: data.email, role: data.role })
      );
      if (data.refresh_token)
        localStorage.setItem("refresh_token", data.refresh_token);
      if (data.organization_id)
        localStorage.setItem("organization_id", data.organization_id);

      // 🔹 NEW: save normalized employee app role based on login response
      const appRoleLogin = mapBackendRoleToAppRole(data.role);
      localStorage.setItem("app_role", appRoleLogin);

      const { role: effectiveRole, orgId } = await hydrateFromMe(
        data.role,
        data.organization_id
      );

      toast({ title: "Welcome back!", description: "Logged in successfully." });
      redirectByRole(effectiveRole, orgId);
    } catch (err: any) {
      console.error("Login error:", err);

      let message = "Login failed. Please try again.";

      const detail = err?.response?.data?.detail ?? err?.message;
      if (typeof detail === "string") {
        if (detail.includes("LOGIN_ERR")) {
          message = "Invalid email or password.";
        } else {
          message = detail;
        }
      }

      setFormError(message);
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = loading || !email.trim() || !password.trim();

  return (
    <Box
      className={cn(
        "min-h-screen flex items-center justify-center",
        "bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(43,182,115,0.12),transparent),radial-gradient(1200px_600px_at_120%_110%,rgba(32,129,226,0.10),transparent)]"
      )}
    >
      <Card
        elevation={0}
        className={cn("w-full max-w-md glass-card rounded-2xl shadow-xl")}
        sx={{
          borderRadius: "20px",
          border: "1px solid rgba(16,24,40,0.06)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.60))",
        }}
      >
        <CardContent className={cn("p-8")}>
          {/* Brand header */}
          <Box className="text-center mb-6">
            <Box className="mx-auto mb-3 flex items-center justify-center gap-2">
              {logoOk ? (
                <img
                  src="/assets/logo.svg"
                  alt="Logo"
                  className="h-8 w-auto"
                  onError={() => setLogoOk(false)}
                />
              ) : (
                <Avatar
                  variant="rounded"
                  className="rounded-xl"
                  sx={{
                    width: 40,
                    height: 40,
                    color: "#fff",
                    background:
                      "linear-gradient(135deg, var(--logo-blue, #2081E2), var(--logo-green, #2BB673))",
                    boxShadow: "0 8px 22px rgba(43,182,115,0.25)",
                  }}
                >
                  <FiLogIn />
                </Avatar>
              )}
              <Typography
                variant="h6"
                sx={{ fontWeight: 800, letterSpacing: 0.2 }}
              >
                Sign in
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Use your work email to continue
            </Typography>
          </Box>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (formError) setFormError(null);
              }}
              fullWidth
              required
              disabled={loading}
              inputProps={{ inputMode: "email", autoComplete: "username" }}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (formError) setFormError(null);
              }}
              fullWidth
              required
              disabled={loading}
              inputProps={{ autoComplete: "current-password" }}
              sx={{ mb: 1.5 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((s) => !s)}
                      edge="end"
                      tabIndex={-1}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {formError && (
              <Typography
                variant="body2"
                color="error"
                sx={{ mb: 1 }}
              >
                {formError}
              </Typography>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={isSubmitDisabled}
              className="!py-3"
              sx={{
                mt: 1,
                textTransform: "none",
                fontWeight: 700,
                boxShadow: "0 8px 18px rgba(43,182,115,0.20)",
                background:
                  "linear-gradient(135deg, var(--logo-green, #2BB673), var(--logo-blue, #2081E2))",
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <Typography
            variant="caption"
            display="block"
            align="center"
            className="mt-4 text-gray-500"
          >
            By continuing, you agree to our Terms &amp; Privacy Policy
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

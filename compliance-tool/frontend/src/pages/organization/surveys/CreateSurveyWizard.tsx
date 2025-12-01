import * as React from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  DataGrid,
  GridToolbarQuickFilter,
  GridToolbarContainer,
} from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { FiX } from "react-icons/fi";
import { useSurveyStore } from "./useSurveyStore";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";

type Props = { open: boolean; onClose: () => void };

type RoleRow = {
  id: string;
  name: string;
};

type EmpRow = {
  id: string;
  name: string;
  email: string;
  role_name: string;
  competencys: { name: string }[];
};

export default function CreateSurveyWizard({ open, onClose }: Props) {
  const { orgId = "" } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { roles, competencys, rolecompetencys, employees, levels, createSurveyScoped } =
    useSurveyStore();

  // step control
  const [step, setStep] = React.useState<0 | 1>(0);

  // meta
  const [name, setName] = React.useState("");
  const [createdBy, setCreatedBy] = React.useState(user?.email ?? "");

  // role selection
  const [selectedRoleIds, setSelectedRoleIds] = React.useState<string[]>([]);

  const allRoleIds = React.useMemo(
    () => roles.map((r) => r.id),
    [roles]
  );

  const toggleAll = (checked: boolean) => {
    setSelectedRoleIds(checked ? [...allRoleIds] : []);
  };

  // --- Role grid columns ---
  const roleColumns = React.useMemo<GridColDef<RoleRow>[]>(
    () => [
      {
        field: "check",
        headerName: "",
        width: 56,
        sortable: false,
        filterable: false,
        renderHeader: () => (
          <Checkbox
            checked={
              allRoleIds.length > 0 &&
              selectedRoleIds.length === allRoleIds.length
            }
            indeterminate={
              selectedRoleIds.length > 0 &&
              selectedRoleIds.length < allRoleIds.length
            }
            onChange={(e) => toggleAll(e.target.checked)}
          />
        ),
        renderCell: ({ row }: any) => (
          <Checkbox
            checked={selectedRoleIds.includes(row.id)}
            onChange={(e) => {
              const id = row.id;
              setSelectedRoleIds((prev) =>
                e.target.checked
                  ? [...prev, id]
                  : prev.filter((x) => x !== id)
              );
            }}
          />
        ),
      },
      {
        field: "name",
        headerName: "Role",
        flex: 1,
        minWidth: 180,
      },
      {
        field: "competencys",
        headerName: "Key competencys",
        flex: 1.6,
        minWidth: 260,
        valueGetter: ({ row }: any) => {
          const sids = rolecompetencys
            .filter((rs) => rs.role_id === row.id)
            .map((rs) => rs.competency_id);
          return competencys
            .filter((s) => sids.includes(s.id))
            .map((s) => s.name)
            .join(", ");
        },
      },
    ],
    [allRoleIds, rolecompetencys, selectedRoleIds, competencys]
  );

  // --- Employee preview columns ---
  const empColumns = React.useMemo<GridColDef<EmpRow>[]>(
    () => [
      {
        field: "name",
        headerName: "Employee",
        flex: 1,
        minWidth: 180,
        valueGetter: ({ row }: any) => `${row.name} (${row.email})`,
      },
      {
        field: "role_name",
        headerName: "Role",
        width: 180,
      },
      {
        field: "competencys",
        headerName: "competencys",
        flex: 1.4,
        minWidth: 240,
        valueGetter: ({ row }: any) =>
          row.competencys.map((s: any) => s.name).join(", "),
      },
    ],
    []
  );

  // --- Derived employees by selected roles ---
  const selectedRoleNames = React.useMemo(
    () => roles.filter((r) => selectedRoleIds.includes(r.id)).map((r) => r.name),
    [roles, selectedRoleIds]
  );

  const scopedEmployees = React.useMemo(
    () => employees.filter((e) => selectedRoleNames.includes(e.role_name)),
    [employees, selectedRoleNames]
  );

  const canNext =
    step === 0
      ? name.trim().length > 0 &&
        createdBy.trim().length > 0 &&
        selectedRoleIds.length > 0
      : true;

  const create = () => {
    const s = createSurveyScoped(
      {
        name: name.trim(),
        created_by: createdBy.trim(),
        organization_id: orgId,
      },
      selectedRoleIds
    );
    onClose();
    nav(`/org/${orgId}/organization/surveys/${s.id}`);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          {step === 0
            ? "Create Survey · Select Roles"
            : "Create Survey · Preview People"}
        </Typography>
        <IconButton onClick={onClose}>
          <FiX />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* Step 0: Meta + Role selection */}
        {step === 0 && (
          <Box sx={{ display: "grid", gap: 12 }}>
            <Box
              className="glass-card rounded-2xl p-3"
              sx={{ mb: 2 }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
              >
                <TextField
                  label="Survey name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Survey done by (email)"
                  value={createdBy}
                  onChange={(e) => setCreatedBy(e.target.value)}
                  fullWidth
                />
              </Stack>
            </Box>

            <Box
              className="glass rounded-2xl"
              sx={{ p: 0, overflow: "hidden" }}
            >
              <DataGrid
                rows={roles as RoleRow[]}
                columns={roleColumns}
                getRowId={(r) => r.id}
                autoHeight
                checkboxSelection={false}
                disableRowSelectionOnClick
                slots={{
                  toolbar: () => (
                    <GridToolbarContainer
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        px: 2,
                        py: 1,
                        backdropFilter: "blur(10px)",
                        background:
                          "rgba(255,255,255,0.18)",
                        borderBottom:
                          "1px solid rgba(255,255,255,0.15)",
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 600,
                          color: "var(--color-text)",
                        }}
                      >
                        Pick roles to include in this survey
                      </Typography>
                      <Box
                        sx={{
                          "& input": {
                            color:
                              "var(--color-text-muted)",
                            background:
                              "rgba(255,255,255,0.15)",
                            borderRadius: "8px",
                            padding: "6px 10px",
                            border:
                              "1px solid rgba(255,255,255,0.15)",
                          },
                        }}
                      >
                        <GridToolbarQuickFilter />
                      </Box>
                    </GridToolbarContainer>
                  ),
                }}
                sx={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-text)",
                  "& .MuiDataGrid-columnHeaders": {
                    background:
                      "rgba(255,255,255,0.25)",
                    backdropFilter: "blur(8px)",
                    borderBottom:
                      "1px solid rgba(255,255,255,0.18)",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    color: "var(--color-text)",
                  },
                  "& .MuiDataGrid-cell": {
                    color:
                      "var(--color-text-muted)",
                    borderBottom:
                      "1px solid rgba(255,255,255,0.12)",
                  },
                }}
              />
            </Box>

            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 1,
                mt: 2,
              }}
            >
              <Button
                variant="outlined"
                onClick={onClose}
                sx={{ textTransform: "none" }}
              >
                Cancel
              </Button>
              <Button
                disabled={!canNext}
                className="theme-button"
                onClick={() => setStep(1)}
                sx={{ textTransform: "none" }}
              >
                Next
              </Button>
            </Box>
          </Box>
        )}

        {/* Step 1: Employees preview */}
        {step === 1 && (
          <Box sx={{ display: "grid", gap: 12 }}>
            <Box className="glass-card rounded-2xl p-3 flex items-center justify-between">
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700 }}
              >
                Employees to survey ·{" "}
                <span style={{ opacity: 0.85 }}>
                  {scopedEmployees.length}
                </span>
              </Typography>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  width: {
                    xs: "100%",
                    sm: "auto",
                  },
                }}
              >
                <TextField
                  select
                  size="small"
                  label="Default level (optional preview)"
                  value=""
                  SelectProps={{ native: true }}
                  sx={{ minWidth: 220 }}
                >
                  <option value=""></option>
                  {levels.map((l) => (
                    <option
                      key={l.id}
                      value={l.score}
                    >
                      {l.name} ({l.score})
                    </option>
                  ))}
                </TextField>
              </Stack>
            </Box>

            <Box
              className="glass rounded-2xl"
              sx={{ p: 0, overflow: "hidden" }}
            >
              <DataGrid
                rows={scopedEmployees as EmpRow[]}
                columns={empColumns}
                getRowId={(r) => r.id}
                autoHeight
                disableRowSelectionOnClick
                sx={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-text)",
                  "& .MuiDataGrid-columnHeaders": {
                    background:
                      "rgba(255,255,255,0.25)",
                    backdropFilter: "blur(8px)",
                    borderBottom:
                      "1px solid rgba(255,255,255,0.18)",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    color: "var(--color-text)",
                  },
                  "& .MuiDataGrid-cell": {
                    color:
                      "var(--color-text-muted)",
                    borderBottom:
                      "1px solid rgba(255,255,255,0.12)",
                  },
                }}
              />
            </Box>

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                mt: 2,
              }}
            >
              <Button
                variant="outlined"
                onClick={() => setStep(0)}
                sx={{ textTransform: "none" }}
              >
                Back
              </Button>
              <Box
                sx={{ display: "flex", gap: 1 }}
              >
                <Button
                  variant="outlined"
                  onClick={onClose}
                  sx={{ textTransform: "none" }}
                >
                  Cancel
                </Button>
                <Button
                  className="theme-button"
                  onClick={create}
                  sx={{ textTransform: "none" }}
                  disabled={!scopedEmployees.length}
                >
                  Create survey
                </Button>
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

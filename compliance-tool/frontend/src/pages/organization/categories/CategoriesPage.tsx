import * as React from "react";
import { Box, Button, Drawer, IconButton, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid/models";
import { FiPlus, FiX } from "react-icons/fi";
import { CATEGORIES } from "../surveys/surveysStore";

type Category = typeof CATEGORIES[number];

export default function CategoriesPage() {
  const [rows, setRows] = React.useState<Category[]>([...CATEGORIES]);
  const [open, setOpen] = React.useState(false);

  const cols = React.useMemo<GridColDef<Category>[]>(() => [
    { field: "name", headerName: "Name", flex: 1, minWidth: 160 },
    { field: "description", headerName: "Description", flex: 1, minWidth: 200 },
    { field: "order", headerName: "Order", width: 100 },
  ], []);

  const onAdd: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const description = String(fd.get("description") || "").trim();
    const order = Number(fd.get("order") || 1);
    if (!name) return;
    setRows(prev => [{ id: "cat_" + Math.random().toString(16).slice(2,8), name, description, order }, ...prev]);
    setOpen(false);
    (e.currentTarget as HTMLFormElement).reset();
  };

  return (
    <Box>
      <Box className="glass-card rounded-2xl p-3 mb-3 flex items-center justify-between">
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Categories</Typography>
        <Button className="theme-button" size="small" onClick={() => setOpen(true)}>
          <FiPlus style={{ marginRight: 8 }} /> Add Category
        </Button>
      </Box>

      <Box className="glass rounded-2xl" sx={{ p: 0, overflow: "hidden" }}>
        <DataGrid
          rows={rows}
          columns={cols}
          getRowId={(r) => r.id}
          autoHeight
          checkboxSelection
          disableRowSelectionOnClick
          sx={{
            background: "transparent",
            border: "none",
            "& .MuiDataGrid-columnHeaders": {
              background: "rgba(255,255,255,0.25)",
              backdropFilter: "blur(8px)",
            },
            "& .MuiDataGrid-cell": {
              color: "var(--color-text-muted)",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
            },
          }}
        />
      </Box>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: { xs: 360, sm: 420 }, p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Add category</Typography>
            <IconButton onClick={() => setOpen(false)}><FiX /></IconButton>
          </Box>
          <form onSubmit={onAdd} className="space-y-3">
            <TextField name="name" label="Name" fullWidth required />
            <TextField name="description" label="Description" fullWidth />
            <TextField name="order" type="number" label="Order" fullWidth defaultValue={rows.length + 1} />
            <Button type="submit" variant="contained" className="theme-button" sx={{ textTransform: "none", fontWeight: 700 }}>
              Save
            </Button>
          </form>
        </Box>
      </Drawer>
    </Box>
  );
}

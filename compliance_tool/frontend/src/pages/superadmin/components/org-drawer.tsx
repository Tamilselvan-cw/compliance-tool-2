// src/components/specific/OrgDrawer.tsx
import * as React from "react";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { FiPlus, FiTrash2, FiX } from "react-icons/fi";

/* -------------------------------------------
   Types
------------------------------------------- */
export type OrgDrawerProps = {
  open: boolean;
  mode: "create" | "details";
  org?: {
    id: string;
    name: string;
    adminEmail?: string;
    createdAt?: string;
  };

  onClose: () => void;

  onCreate?: (data: {
    name: string;
    admins: Array<{ name: string; email: string }>;
  }) => void;

  onUpdate?: (patch: Partial<{ name: string; adminEmail: string }>) => void;

  onDelete?: (id: string) => void;

  onInviteAdmins?: (
    orgId: string,
    admins: Array<{ name: string; email: string }>
  ) => void;

  /**
   * Optional function to lazily fetch full organization details when the drawer
   * opens in `details` mode. Should return shape:
   * { name: string; admins: Array<{ name: string; email: string }> }
   */
  fetchOrgDetails?: (orgId: string) => Promise<{
    name: string;
    admins: Array<{ name: string; email: string }>;
  }>;

  /**
   * Loading flags (optional). When any of these are true,
   * the UI will be disabled and the buttons show the "…ing" text.
   */
  creating?: boolean;
  updating?: boolean;
  inviting?: boolean;
  deleting?: boolean;
  disabled?: boolean; // convenience: disable all fields
};

/* -------------------------------------------
   Component
------------------------------------------- */
export default function OrgDrawer({
  open,
  mode,
  org,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onInviteAdmins,
  fetchOrgDetails,
  creating = false,
  updating = false,
  inviting = false,
  deleting = false,
  disabled = false,
}: OrgDrawerProps) {
  const isCreate = mode === "create";

  // local states that may be populated by fetchOrgDetails
  const [orgName, setOrgName] = React.useState(org?.name || "");
  const [admins, setAdmins] = React.useState<
    Array<{ name: string; email: string }>
  >([{ name: "", email: "" }]);

  // lazy render admin list only when it becomes visible in viewport
  const adminListRef = React.useRef<HTMLDivElement | null>(null);
  const [adminsVisible, setAdminsVisible] = React.useState(false);
  
  // lazy-load state
  const [loadingDetails, setLoadingDetails] = React.useState(false);
  const [detailsError, setDetailsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // if details are loading we want to show skeletons anyway
    if (loadingDetails) return;

    // If already visible or no DOM, do nothing
    if (adminsVisible) return;
    const el = adminListRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      // fallback — immediately show
      setAdminsVisible(true);
      return;
    }

    let cancelled = false;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !cancelled) {
            setAdminsVisible(true);
            // once visible, we don't need the observer
            obs.disconnect();
          }
        });
      },
      { root: null, rootMargin: "200px", threshold: 0.01 }
    );

    obs.observe(el);

    return () => {
      cancelled = true;
      obs.disconnect();
    };
  }, [adminsVisible, loadingDetails]);

  // Reset when drawer opens or org prop changes
  React.useEffect(() => {
    setDetailsError(null);

    // Create mode: clear fields immediately
    if (isCreate) {
      setOrgName("");
      setAdmins([{ name: "", email: "" }]);
      setLoadingDetails(false);
      return;
    }

    // Details mode: prefer lazy fetch if fetchOrgDetails is provided
    if (!isCreate && org) {
      if (fetchOrgDetails) {
        let active = true;
        setLoadingDetails(true);

        (async () => {
          try {
            const d = await fetchOrgDetails(org.id);
            if (!active) return;
            setOrgName(d?.name ?? org.name ?? "");
            setAdmins(
              Array.isArray(d?.admins) && d.admins.length > 0
                ? d.admins
                : [{ name: "", email: org.adminEmail ?? "" }]
            );
          } catch (err: any) {
            console.error("Failed to load org details:", err);
            if (!active) return;
            setDetailsError(
              (err && err.message) || "Failed to load organization details"
            );
            // fallback to minimal org prop so UI still shows
            setOrgName(org.name ?? "");
            setAdmins([{ name: "", email: org.adminEmail ?? "" }]);
          } finally {
            if (active) setLoadingDetails(false);
          }
        })();

        return () => {
          active = false;
        };
      }

      // If no fetch function provided, use provided org prop
      setOrgName(org.name ?? "");
      setAdmins([{ name: "", email: org.adminEmail ?? "" }]);
      setLoadingDetails(false);
    }
  }, [open, mode, org?.id, org?.name, org?.adminEmail, isCreate, fetchOrgDetails]);

  /* --------------------
     Admin add/remove
  -------------------- */
  const addAdmin = () => {
    if (admins.length >= 3) return;
    setAdmins([...admins, { name: "", email: "" }]);
  };

  const removeAdmin = (i: number) => {
    if (admins.length <= 1) return; // must keep at least one
    setAdmins(admins.filter((_, idx) => idx !== i));
  };

  const updateAdmin = (i: number, field: "name" | "email", value: string) => {
    const clone = [...admins];
    clone[i][field] = value;
    setAdmins(clone);
  };

  /* --------------------
     Save Handlers
  -------------------- */
  const handleCreate = () => {
    if (!onCreate) return;
    onCreate({
      name: orgName,
      admins,
    });
  };

  const handleUpdate = () => {
    if (!onUpdate || !org) return;
    onUpdate({
      name: orgName,
      adminEmail: admins[0]?.email,
    });
  };

  const handleInviteMore = () => {
    if (!onInviteAdmins || !org) return;
    onInviteAdmins(org.id, admins);
  };

  const handleDelete = () => {
    if (!onDelete || !org) return;
    onDelete(org.id);
  };

  const anyLoading =
    creating || updating || inviting || deleting || disabled || loadingDetails;

  /* -------------------------------------------
     Render helpers (skeletons)
  ------------------------------------------- */
  const SkeletonLine: React.FC<{ className?: string }> = ({ className = "" }) => (
    <div className={`h-8 rounded-md bg-gray-200/70 animate-pulse ${className}`} />
  );

  /* -------------------------------------------
     Render
  ------------------------------------------- */
  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent className="max-w-lg ml-auto rounded-l-2xl shadow-2xl">
        <DrawerHeader className="flex justify-between items-start pb-1">
          <div>
            <DrawerTitle className="text-xl font-semibold flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-lg">
                ⬛
              </div>
              {isCreate ? "New organization" : "Organization details"}
            </DrawerTitle>

            <DrawerDescription className="text-muted-foreground mt-1">
              {isCreate
                ? "Create a new organization workspace"
                : loadingDetails
                ? "Loading organization details…"
                : detailsError
                ? "Failed to load details"
                : "Update organization information"}
            </DrawerDescription>
          </div>

          <DrawerClose>
            <FiX
              className={`text-xl text-muted-foreground hover:text-black cursor-pointer ${
                anyLoading ? "opacity-50 pointer-events-none" : ""
              }`}
            />
          </DrawerClose>
        </DrawerHeader>

        <div className="px-6 pb-6 overflow-y-auto max-h-[80vh] custom-scroll">
          {/* Organization Name */}
          <div className="mt-2 mb-5">
            <label className="text-sm font-medium">Organization name</label>

            {loadingDetails ? (
              <div className="mt-1">
                <SkeletonLine />
              </div>
            ) : (
              <Input
                className="mt-1"
                placeholder="Enter name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={anyLoading}
              />
            )}

            {detailsError && (
              <div className="text-xs text-red-600 mt-1">{detailsError}</div>
            )}
          </div>

          {/* Admin Users */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium">Admin users</p>
              <p className="text-xs text-muted-foreground">
                (Min 1, Max 3 admins)
              </p>
            </div>

            <div ref={adminListRef} className="rounded-xl border p-3 bg-white">
              {/* If overall details are loading: show full skeleton */}
              {loadingDetails ? (
                <>
                  <div className="mb-3 grid grid-cols-12 gap-3">
                    <div className="col-span-5"><SkeletonLine /></div>
                    <div className="col-span-6"><SkeletonLine /></div>
                    <div className="col-span-1 flex items-center justify-center">
                      <div className="h-8 w-8 rounded-full bg-gray-200/70 animate-pulse" />
                    </div>
                  </div>

                  <div className="mb-3 grid grid-cols-12 gap-3">
                    <div className="col-span-5"><SkeletonLine /></div>
                    <div className="col-span-6"><SkeletonLine /></div>
                    <div className="col-span-1 flex items-center justify-center">
                      <div className="h-8 w-8 rounded-full bg-gray-200/70 animate-pulse" />
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="h-10 rounded-md bg-gray-200/70 animate-pulse" />
                  </div>
                </>
              ) : (
                // Not loading details
                <>
                  {/* If admin list hasn't come into view yet, render lightweight placeholders (cheap to paint) */}
                  {!adminsVisible ? (
                    <>
                      <div className="mb-3 grid grid-cols-12 gap-3">
                        <div className="col-span-11">
                          <div className="h-9 rounded-md bg-gray-100" />
                        </div>
                        <div className="col-span-1 flex items-center justify-center">
                          <div className="h-8 w-8 rounded-full bg-gray-100" />
                        </div>
                      </div>

                      <div className="mb-3 grid grid-cols-12 gap-3">
                        <div className="col-span-11">
                          <div className="h-9 rounded-md bg-gray-100" />
                        </div>
                        <div className="col-span-1 flex items-center justify-center">
                          <div className="h-8 w-8 rounded-full bg-gray-100" />
                        </div>
                      </div>

                      {/* small hint that more will load when scrolled */}
                      <div className="text-xs text-muted-foreground mt-1">Scroll to load admins</div>
                    </>
                  ) : (
                    // Actual admin inputs (rendered only after visible)
                    <>
                      {admins.map((a, i) => (
                        <div key={i} className="grid grid-cols-12 gap-3 mb-3">
                          <Input
                            placeholder="Name"
                            className="col-span-5"
                            value={a.name}
                            onChange={(e) => updateAdmin(i, "name", e.target.value)}
                            disabled={anyLoading}
                          />
                          <Input
                            placeholder="Email"
                            className="col-span-6"
                            value={a.email}
                            onChange={(e) => updateAdmin(i, "email", e.target.value)}
                            disabled={anyLoading}
                          />

                          <button
                            disabled={admins.length <= 1 || anyLoading}
                            onClick={() => removeAdmin(i)}
                            className="col-span-1 flex items-center justify-center text-red-500"
                            aria-label={`Remove admin ${i + 1}`}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      ))}

                      {/* Add Admin Button */}
                      {admins.length < 3 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={addAdmin}
                          className="flex items-center gap-2 mt-1 text-primary"
                          disabled={anyLoading}
                        >
                          <FiPlus /> Add
                        </Button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

          </div>
        </div>

        <DrawerFooter className="px-6 pb-6">
          <div className="flex justify-between">
            <Button variant="outline" onClick={onClose} disabled={anyLoading}>
              Cancel
            </Button>

            {isCreate ? (
              <Button onClick={handleCreate} disabled={anyLoading}>
                {creating ? "Creating..." : "Create"}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleUpdate}
                  disabled={anyLoading}
                >
                  {updating ? "Saving..." : "Save"}
                </Button>

                <Button
                  variant="secondary"
                  onClick={handleInviteMore}
                  disabled={anyLoading}
                >
                  {inviting ? "Inviting..." : "Invite Admins"}
                </Button>

                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={anyLoading}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

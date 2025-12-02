import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "../lib/utils";
import { Button } from "./button";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogPortal = AlertDialogPrimitive.Portal;
export const AlertDialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 bg-black/40", className)}
    {...props}
  />
));
AlertDialogOverlay.displayName = "AlertDialogOverlay";

export const AlertDialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-4 shadow-lg",
        className
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = "AlertDialogContent";

export const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("space-y-1.5", className)} {...props} />
);
export const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex justify-end gap-2", className)} {...props} />
);
export const AlertDialogTitle = AlertDialogPrimitive.Title;
export const AlertDialogDescription = AlertDialogPrimitive.Description;

export const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> & React.ComponentPropsWithoutRef<"button">
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action asChild>
    <Button ref={ref} className={className} {...props} />
  </AlertDialogPrimitive.Action>
));
AlertDialogAction.displayName = "AlertDialogAction";

export const AlertDialogCancel = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel> & React.ComponentPropsWithoutRef<"button">
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel asChild>
    <Button ref={ref} variant="outline" className={className} {...props} />
  </AlertDialogPrimitive.Cancel>
));
AlertDialogCancel.displayName = "AlertDialogCancel";

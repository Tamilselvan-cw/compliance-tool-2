import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDeleteDialog({
  open,
  title,
  description,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog 
      open={open} 
      onOpenChange={onCancel}
    >
      {/* White modal box — clean, rounded, shadow */}
      <DialogContent
        className="
          bg-white 
          text-black 
          rounded-2xl 
          shadow-xl 
          border 
          border-gray-200
        "
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900">
            {title}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-600">{description}</p>

        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="text-green-600 hover:text-green-700 hover:bg-green-50"
          >
            Cancel
          </Button>

          <Button
            variant="destructive"
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

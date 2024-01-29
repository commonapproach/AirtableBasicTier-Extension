import Base from "@airtable/blocks/dist/types/src/models/base";
import { Button, Dialog, Input, Text } from "@airtable/blocks/ui";
import React, { useState } from "react";
import { useDialog } from "../context/DialogContext";
import { exportData } from "../export/export";

interface ExportDialogProps {
  base: Base;
  isDialogOpen: boolean;
  setDialogOpen: (isOpen: boolean) => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  base,
  isDialogOpen,
  setDialogOpen,
}) => {
  const { setDialogContent } = useDialog();
  const [inputValue, setInputValue] = useState("");

  const handleExport = async () => {
    // Clean the input value to make it compatible with all file systems
    const cleanedOrgName = inputValue.replace(/[^\w]/gi, "");

    // Check if the input value is empty
    if (!cleanedOrgName) {
      setDialogContent(
        "Error",
        "Please enter the name of the organization you want to export",
        true
      );
      return;
    }

    // Set the cleaned org name using the provided hook
    try {
      await exportData(base, setDialogContent, cleanedOrgName);
    } catch (error) {
      console.log(error);
      setDialogContent("Error", error.message || "Something went wrong", true);
    }

    // Close the dialog
    setDialogOpen(false);
    setInputValue("");
  };

  return (
    <>
      {isDialogOpen && (
        <Dialog
          onClose={() => {
            setDialogOpen(false);
          }}
          width="320px"
        >
          <Dialog.CloseButton />
          <Text variant="paragraph">
            Enter the name of the organization you want to export:
          </Text>
          <div style={{ marginBottom: 12 }}>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter organization name"
            />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <Button onClick={handleExport}>Export</Button>
          </div>
        </Dialog>
      )}
    </>
  );
};

export default ExportDialog;

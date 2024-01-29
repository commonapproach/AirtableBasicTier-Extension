import Base from "@airtable/blocks/dist/types/src/models/base";
import { Button, Dialog, Input, Text } from "@airtable/blocks/ui";
import React, { useState } from "react";
import { exportData } from "../export/export";

interface ExportDialogProps {
  base: Base;
  setDialogContent: (content: React.ReactNode) => void;
  isDialogOpen: boolean;
  setDialogOpen: (isOpen: boolean) => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  base,
  setDialogContent,
  isDialogOpen,
  setDialogOpen,
}) => {
  const [inputValue, setInputValue] = useState("");

  const handleExport = () => {
    // Clean the input value to make it compatible with all file systems
    const cleanedOrgName = inputValue.replace(/[^\w]/gi, "");

    // Set the cleaned org name using the provided hook
    exportData(base, setDialogContent, cleanedOrgName);

    // Close the dialog
    setDialogOpen(false);
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

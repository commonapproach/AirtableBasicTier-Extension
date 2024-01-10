import { Button, Icon, initializeBlock, useBase } from "@airtable/blocks/ui";
import React, { useRef } from "react";
import { exportData } from "./export/export";
import { importData } from "./import/import";
import { handleFileChange } from "./utils";
import DialogContextProvider, { useDialog } from "./context/DialogContext";

function Main() {
  const base = useBase();
  const fileInputRef = useRef(null);
  const { setDialogContent } = useDialog();

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Open the file dialog
    fileInputRef.current.click();
  };

  return (
    <div style={{ padding: 12 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-evenly",
          gap: 4,
        }}
      >
        <Button
          style={{ border: "1px solid black" }}
          onClick={handleButtonClick}
        >
          <div
            style={{
              alignItems: "center",
              textAlign: "center",
              display: "flex",
              gap: 2,
            }}
          >
            <Icon name="upload" size={16} />
            Import Data
          </div>
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            handleFileChange(e, async (josnData) => {
              try {
                setDialogContent(
                  "Importing Data...",
                  "Wait for a while...",
                  true
                );
                await importData(josnData, base);
                setDialogContent("Success", "Data imported successfully", true);
              } catch (error) {
                setDialogContent(
                  "Error",
                  error.message || "Something went wrong",
                  true
                );
              }
              // Reset the input value
              if (document.body.contains(e.target)) {
                e.target.value = "";
              }
            });
          }}
          style={{ display: "none" }}
          accept=".jsonld,application/ld+json"
        />

        <Button
          style={{ border: "1px solid black" }}
          onClick={async () => {
            try {
              await exportData(base, setDialogContent);
            } catch (error) {
              setDialogContent(
                "Error",
                error.message || "Something went wrong",
                true
              );
            }
          }}
        >
          <div
            style={{
              alignItems: "center",
              textAlign: "center",
              display: "flex",
              gap: 2,
            }}
          >
            <Icon name="download" size={16} />
            Export Data
          </div>
        </Button>
      </div>
    </div>
  );
}

initializeBlock(() => (
  <DialogContextProvider>
    <Main />
  </DialogContextProvider>
));

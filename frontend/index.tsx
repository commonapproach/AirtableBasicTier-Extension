import { Button, Icon, initializeBlock, useBase } from "@airtable/blocks/ui";
import React, { useRef } from "react";
import { exportData } from "./export/export";
import { importData } from "./import/import";
import { handleFileChange } from "./utils";
import DialogContextProvider, { useDialog } from "./context/DialogContext";

function Main() {
  const base = useBase();
  const fileInputRef = useRef(null);
  const { setOpenDialog, setText, setHeader } = useDialog();

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
        <Button style={{ border: "1px solid black" }} onClick={() => fileInputRef.current.click()}>
          <div style={{ alignItems: "center", textAlign: "center", display: "flex", gap: 2 }}>
            <Icon name="upload" size={16} />
            Import Data
          </div>
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) =>
            handleFileChange(e, async (josnData) => {
              try {
                setHeader("Importing Data...");
                setText("Wait for a while...");
                setOpenDialog(true);
                await importData(josnData, base);
                setHeader("Success");
                setText("Data imported successfully");
              } catch (error) {
                setHeader("Error");
                setText(error.message || "Something went wrong");
              }
            })
          }
          style={{ display: "none" }}
          accept=".jsonld,application/ld+json"
        />
        <Button
          style={{ border: "1px solid black" }}
          onClick={async () => {
            setHeader("Exporting Data...");
            setText("Wait for a while...");
            setOpenDialog(true);
            await exportData(base);
            setHeader("Success");
            setText("Data exported successfully");
          }}
        >
          <div style={{ alignItems: "center", textAlign: "center", display: "flex", gap: 2 }}>
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

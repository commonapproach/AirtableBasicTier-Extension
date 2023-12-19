import { Button, TablePickerSynced, initializeBlock, useBase, useGlobalConfig } from "@airtable/blocks/ui";
import React, { useRef } from "react";
import { exportData } from "./export";
import { importData } from "./import";

function TodoExtension() {
  const base = useBase();
  const globalConfig = useGlobalConfig();
  const tableId = globalConfig.get("selectedTableId");
  const table = base.getTableByIdIfExists(tableId as string);
  const fileInputRef = useRef(null);

  const handleFileChange = async (event: any) => {
    const file = event.target.files[0];
    if (file && file.type === "application/ld+json") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = JSON.parse(e.target.result as any);
        importData(data, base); // Modify this as per your importData function's implementation
      };
      reader.readAsText(file);
    } else {
      console.log(file);
      console.error("Please select a JSON-LD file.");
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <TablePickerSynced globalConfigKey="selectedTableId" />
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-evenly",
          gap: 4,
        }}
      >
        <Button style={{ border: "1px solid black" }} onClick={() => fileInputRef.current.click()}>
          Import Data
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
          accept=".jsonld,application/ld+json"
        />
        <Button style={{ border: "1px solid black" }} onClick={() => exportData(base)}>
          Export Data
        </Button>
      </div>
      <div>Notifications:</div>
    </div>
  );
}

initializeBlock(() => <TodoExtension />);

import { Button, TablePickerSynced, initializeBlock, useBase } from "@airtable/blocks/ui";
import React, { useRef } from "react";
import { exportData } from "./export";
import { importData } from "./import";
import { handleFileChange } from "./utils";

function TodoExtension() {
  const base = useBase();
  // const globalConfig = useGlobalConfig();
  // const tableId = globalConfig.get("selectedTableId");
  // const table = base.getTableByIdIfExists(tableId as string);
  const fileInputRef = useRef(null);

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
          onChange={(e) => handleFileChange(e, (data) => importData(data, base))}
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

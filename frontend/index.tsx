import {
  Button,
  Icon,
  Select,
  initializeBlock,
  useBase,
} from "@airtable/blocks/ui";
import React, { useEffect, useRef, useState } from "react";
import { exportData } from "./export/export";
import { importData } from "./import/import";
import { handleFileChange } from "./utils";
import DialogContextProvider, { useDialog } from "./context/DialogContext";

function Main() {
  const base = useBase();
  const fileInputRef = useRef(null);
  const { setDialogContent } = useDialog();
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);

  useEffect(() => {
    if (options.length > 0) return;
    const table = base.getTableByNameIfExists("Organization");
    if (!table) return;
    table.selectRecordsAsync().then((data) => {
      const opts = data.records.map((record) => {
        return {
          value: record.getCellValue("org:hasLegalName"),
          label: record.getCellValue("org:hasLegalName"),
        };
      });

      setOptions(opts);
      setSelectedOption(opts[0].value);
    });
  }, []);

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
                await importData(josnData, base, setDialogContent);
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
          accept=".jsonld, .json, application/ld+json, application/json"
        />

        <Button
          style={{ border: "1px solid black" }}
          onClick={async () => {
            try {
              await exportData(base, setDialogContent, selectedOption);
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 8,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <p>Select an Organization</p>
        <Select
          options={options}
          value={selectedOption}
          onChange={(newValue) => setSelectedOption(newValue)}
          width="280px"
        />
      </div>
    </div>
  );
}

initializeBlock(() => (
  <DialogContextProvider>
    <Main />
  </DialogContextProvider>
));

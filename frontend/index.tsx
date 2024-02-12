import {
  Button,
  Icon,
  Text,
  initializeBlock,
  useBase,
} from "@airtable/blocks/ui";
import React, { useRef, useState } from "react";
import ExportDialog from "./components/ExportDialog";
import Loading from "./components/Loading";
import DialogContextProvider, { useDialog } from "./context/DialogContext";
import { importData } from "./import/import";
import { handleFileChange } from "./utils";

function Main() {
  const base = useBase();
  const fileInputRef = useRef(null);
  const { setDialogContent } = useDialog();
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Open the file dialog
    fileInputRef.current.click();
  };

  return (
    <>
      <Loading isLoading={isLoading} />
      <ExportDialog
        base={base}
        isDialogOpen={isExportDialogOpen}
        setDialogOpen={setIsExportDialogOpen}
      />
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
            style={{
              border: "1px solid #3caea3",
              backgroundColor: "rgba(0,0,0,0)",
            }}
            onClick={handleButtonClick}
            disabled={isImporting}
          >
            <div
              style={{
                alignItems: "center",
                textAlign: "center",
                display: "flex",
                gap: 2,
                color: "#3caea3",
              }}
            >
              <Icon name="upload" size={16} />
              Import Data
            </div>
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={async (e) => {
              handleFileChange(
                e,
                async (josnData) => {
                  setIsLoading(true);
                  try {
                    await importData(
                      josnData,
                      base,
                      setDialogContent,
                      setIsImporting
                    );
                  } catch (error) {
                    setIsImporting(false);
                    console.log(error);
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
                  setIsLoading(false);
                },
                (error) => {
                  setDialogContent(
                    "Error",
                    error.message || "Something went wrong",
                    true
                  );
                }
              );
            }}
            style={{ display: "none" }}
          />
          <Button
            style={{
              border: "1px solid #50b7e0",
              backgroundColor: "rgba(0,0,0,0)",
            }}
            disabled={isImporting}
            onClick={async () => {
              setIsExportDialogOpen(true);
            }}
          >
            <div
              style={{
                alignItems: "center",
                textAlign: "center",
                display: "flex",
                gap: 2,
                color: "#50b7e0",
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
            justifyContent: "center",
            alignItems: "center",
            height: "80vh",
          }}
        >
          <img
            src="./static/common_approach_logo_300x71.png"
            alt="Common Approach To Impact Measurement"
          />
          <Text variant="paragraph" style={{ margin: 10 }}>
            Compliant with Common Impact Data Standard Version 2.1
          </Text>
          <Text variant="paragraph">
            <strong>Basic Tier</strong>
          </Text>
        </div>
      </div>
    </>
  );
}

initializeBlock(() => (
  <DialogContextProvider>
    <Main />
  </DialogContextProvider>
));

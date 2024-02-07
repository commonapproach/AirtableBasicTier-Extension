import {
  Button,
  Icon,
  Text,
  // Select,
  initializeBlock,
  useBase,
} from "@airtable/blocks/ui";
import React, { /* useEffect, */ useRef, useState } from "react";
import Loading from "./components/Loading";
import DialogContextProvider, { useDialog } from "./context/DialogContext";
// import { exportData } from "./export/export";
import ExportDialog from "./components/ExportDialog";
import { importData } from "./import/import";
import { handleFileChange } from "./utils";

function Main() {
  const base = useBase();
  const fileInputRef = useRef(null);
  const { setDialogContent } = useDialog();
  // const [options, setOptions] = useState([]);
  // const [selectedOption, setSelectedOption] = useState(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // useEffect(() => {
  //   if (options.length > 0) return;
  //   const table = base.getTableByNameIfExists("Organization");
  //   if (!table) return;
  //   table.selectRecordsAsync().then((data) => {
  //     const opts = data.records.map((record) => {
  //       return {
  //         value: record.getCellValue("org:hasLegalName"),
  //         label: record.getCellValue("org:hasLegalName"),
  //       };
  //     });

  //     setOptions(opts);
  //     if (opts.length > 0) {
  //       setSelectedOption(opts[0].value);
  //     }
  //   });
  // }, []);

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
                    await importData(josnData, base, setDialogContent);
                  } catch (error) {
                    console.error(error)
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
            onClick={async () => {
              // try {
              setIsExportDialogOpen(true);
              // await exportData(base, setDialogContent, selectedOption);
              // } catch (error) {
              //   console.log(error);
              //   setDialogContent(
              //     "Error",
              //     error.message || "Something went wrong",
              //     true
              //   );
              // }
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
        {/* <div
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
        </div> */}

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

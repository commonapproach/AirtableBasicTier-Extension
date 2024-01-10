import Base from "@airtable/blocks/dist/types/src/models/base";
import { downloadJSONLD } from "../utils";
import { LinkedCellInterface } from "../domain/interfaces/cell.interface";
import { map } from "../domain/models";
import { validate } from "../domain/validation/validator";
export async function exportData(
  base: Base,
  setDialogContent: (header: string, text: string, open: boolean) => void
): Promise<void> {
  const tables = base.tables;
  let data = [];

  for (const table of tables) {
    // If the table is not in the map, skip it
    if (!Object.keys(map).includes(table.name)) {
      continue;
    }

    const records = (await table.selectRecordsAsync()).records;

    const cid = new map[table.name]();
    for (const record of records) {
      let row = {
        "@context":
          "http://ontology.eil.utoronto.ca/cids/contexts/cidsContext.json",
        "@type": `cids:${table.name}`,
      };
      for (const field of cid.getFields()) {
        if (field.type === "link") {
          const value = record.getCellValue(field.name);
          row[field.name] =
            //@ts-ignore
            value?.map((item: LinkedCellInterface) => item.name) ?? "";
        } else if (field.type === "i72") {
          row[field.name] = {
            "@context":
              "http://ontology.eil.utoronto.ca/cids/contexts/cidsContext.json",
            "@type": "i72:Measure",
            numerical_value: record.getCellValueAsString(field.name) ?? "",
          };
        } else {
          row[field.name] = record.getCellValue(field.name) ?? "";
        }
      }
      data.push(row);
    }
  }

  const { errors, warnings } = validate(data);

  const allWarnings = checkForNotExportedFields(base) + warnings.join("<hr/>");

  if (errors.length > 0) {
    setDialogContent(
      `Error!`,
      errors.map((item) => `<p>${item}</p>`).join(""),
      true
    );
    return;
  }

  if (warnings.length > 0) {
    setDialogContent(`Warning!`, allWarnings, true);
  }

  // downloadJSONLD(data, `${getFileName()}.jsonld`);
}

function getFileName(): string {
  const date = new Date();

  // Get the year, month, and day from the date
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // Add 1 because months are 0-indexed.
  const day = date.getDate();

  // Format month and day to ensure they are two digits
  const monthFormatted = month < 10 ? "0" + month : month;
  const dayFormatted = day < 10 ? "0" + day : day;

  // Concatenate the components to form the desired format (YYYYMMDD)
  const timestamp = `${year}${monthFormatted}${dayFormatted}`;

  return `CIDSBasic${"OrganizationName"}${timestamp}`;
}

function checkForNotExportedFields(base: Base) {
  let warnings = "";
  for (const table of base.tables) {
    if (!Object.keys(map).includes(table.name)) {
      continue;
    }
    const cid = new map[table.name]();
    const internalFields = cid.getFields().map((item) => item.name);
    const externalFields = table.fields.map((item) => item.name);

    for (const field of externalFields) {
      if (!internalFields.includes(field)) {
        warnings += `Field <b>${field}</b> on table <b>${table.name}</b> was not exported<hr/>`;
      }
    }
  }
  return warnings;
}
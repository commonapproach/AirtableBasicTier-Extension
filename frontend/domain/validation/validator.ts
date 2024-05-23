import { TableInterface } from "../interfaces/table.interface";
import { map } from "../models";

type Operation = "import" | "export";

let validatorErrors = new Set<string>();
let validatorWarnings = new Set<string>();
let indicatorsUrls = [];
export function validate(
  tableData: TableInterface[],
  operation: Operation = "export"
): {
  errors: string[];
  warnings: string[];
} {
  validatorWarnings.clear();
  validatorErrors.clear();

  validateIfEmptyFile(tableData);

  validateIfIdIsValidUrl(tableData, operation);

  tableData = removeEmptyRows(tableData);

  tableData.forEach((item) => {
    validateTypeProp(item);
  });

  validateRecords(tableData, operation);

  return {
    errors: Array.from(validatorErrors),
    warnings: Array.from(validatorWarnings),
  };
}

function validateRecords(tableData: TableInterface[], operation: Operation) {
  // Records to keep track of unique values
  const uniqueRecords: Record<string, Set<any>> = {};

  validateIndicatorsInOrganizations(tableData);

  for (const data of tableData) {
    if (validateTypeProp(data)) return;
    const tableName = data["@type"].split(":")[1];
    const id = data["@id"];
    const cid = new map[tableName](); // Initialize the schema for the table

    // Initialize a record for this table if not already present
    if (!uniqueRecords[tableName]) {
      uniqueRecords[tableName] = new Set();
    }

    //check if required fields are present
    for (const field of cid.getFields()) {
      if (field.required && !Object.keys(data).includes(field.name)) {
        if (field.name === "i72:value" || field.name === "org:hasLegalName") {
          if (
            Object.keys(data).includes("value") ||
            Object.keys(data).includes("hasLegalName")
          ) {
            continue;
          }
        }
        if (operation === "import" && field.name !== "@id") {
          validatorWarnings.add(
            `Required field <b>${field.name}</b> is missing in table <b>${tableName}</b>`
          );
        } else {
          validatorErrors.add(
            `Required field <b>${field.name}</b> is missing in table <b>${tableName}</b>`
          );
        }
      }
    }

    for (const field of cid.getFields()) {
      if (field.semiRequired) {
        if (!Object.keys(data).includes(field.name)) {
          validatorWarnings.add(
            `Required field <b>${field.name}</b> is missing in table <b>${tableName}</b>`
          );
        }
        // @ts-ignore
        if (data[field.name]?.length === 0) {
          validatorWarnings.add(
            `Field <b>${field.name}</b> is empty in table <b>${tableName}</b>`
          );
        }
      }
    }

    // check if notNull fields are not null
    for (const field of cid.getFields()) {
      if (field.notNull && Object.keys(data)?.length === 0) {
        validatorErrors.add(
          `Field <b>${field.name}</b> is null or empty in table <b>${tableName}</b>`
        );
      }
    }

    for (let [fieldName, fieldValue] of Object.entries(data)) {
      if (fieldName === "@context" || fieldName === "@type") continue;
      if (fieldName === "value") {
        fieldName = "i72:value";
      }
      if (fieldName === "hasLegalName") {
        fieldName = "org:hasLegalName";
      }

      const fieldProps: any = cid.getFieldByName(fieldName);

      if (!fieldProps) {
        continue;
      }

      if (Array.isArray(fieldValue)) {
        // check if fieldValue has duplicate values
        const uniqueValues = new Set(fieldValue);
        if (uniqueValues.size !== fieldValue.length) {
          validatorWarnings.add(
            `Duplicate values in field <b>${fieldName}</b> in table <b>${tableName}</b>`
          );
        }
      }

      // Handle 'i72' type fields
      if (fieldProps.type === "i72") {
        // if (!("numerical_value" in fieldValue)) {
        //   validatorErrors.add(
        //     `Invalid value for i72 field <b>${fieldName}</b>: <b>${fieldValue}</b> in table <b>${tableName}</b>`
        //   );
        // }
      } else {
        // Validate unique fields
        if (fieldProps?.unique) {
          if (
            !validateUnique(tableName, fieldName, fieldValue, uniqueRecords, id)
          ) {
            const msg = `Duplicate value for unique field <b>${fieldName}</b>: <b>${fieldValue}</b> in table <b>${tableName}</b>`;
            if (fieldName !== "@id") {
              validatorWarnings.add(msg);
            } else {
              validatorErrors.add(msg);
            }
          }
        }

        if (fieldProps?.notNull) {
          if (fieldValue === "" || !fieldValue) {
            validatorWarnings.add(
              `Field <b>${fieldName}</b> on table <b>${tableName}</b> is null or empty.`
            );
          }
        }

        if (fieldProps?.required) {
          if (fieldValue === "" || !fieldValue) {
            validatorWarnings.add(
              `Field <b>${fieldName}</b> on table <b>${tableName}</b> is required.`
            );
          }
        }
      }
    }
  }
}

function validateUnique(
  tableName: string,
  fieldName: string,
  fieldValue: any,
  uniqueRecords: Record<string, Set<any>>,
  id: string
): boolean {
  // Unique key for this field in the format "tableName.fieldName"
  if (!id) return false;
  let urlObject;

  try {
    urlObject = new URL(id);
  } catch (error) {
    validatorErrors.add(
      `<b>@id</b> on table <b>${tableName}</b> must be formatted as a valid URL`
    );
    return false;
  }

  const baseUrl = `${urlObject.protocol}//${urlObject.hostname}`;

  const uniqueKey = `${tableName}.${fieldName}.${baseUrl}`;

  // Initialize a record for this field if not already present
  if (!uniqueRecords[uniqueKey]) {
    uniqueRecords[uniqueKey] = new Set();
  }

  // Check if the value already exists
  if (uniqueRecords[uniqueKey].has(fieldValue)) {
    // Value is not unique
    return false;
  } else {
    // Record this value as encountered and return true
    uniqueRecords[uniqueKey].add(fieldValue);
    return true;
  }
}

function validateTypeProp(data: any): boolean {
  if (!("@type" in data)) {
    validatorErrors.add("<b>@type</b> must be present in the data");
    return true;
  }
  if (data["@type"].length === 0) {
    validatorErrors.add("<b>@type</b> cannot be empty");
    return true;
  }
  try {
    data["@type"]?.split(":")[1].length === 0;
  } catch (error) {
    validatorErrors.add(
      "<b>@type</b> must follow the format <b>cids:tableName</b>"
    );
    return true;
  }
  const tableName = data["@type"]?.split(":")[1];
  if (!map[tableName]) {
    validatorWarnings.add(
      `Table <b>${tableName}</b> is not recognized in the basic tier and will be ignored.`
    );
    return true;
  }
  return false;
}

function validateIndicatorsInOrganizations(tableData: TableInterface[]) {
  for (const data of tableData) {
    if (validateTypeProp(data)) return;
    const tableName = data["@type"].split(":")[1];
    if (tableName == "Organization") {
      if (!data["hasIndicator"]) {
        validatorWarnings.add(
          `Organization <b>${
            data["org:hasLegalName"] || data["hasLegalName"]
          }</b> has no indicators`
        );
        data["hasIndicator"] = [];
      }
      // @ts-ignore
      data["hasIndicator"].forEach((item) => {
        indicatorsUrls.push(item);
      });
    }
  }

  for (const data of tableData) {
    if (validateTypeProp(data)) return;
    const tableName = data["@type"].split(":")[1];
    if (tableName == "Indicator") {
      // @ts-ignore
      if (data["@id"] && !indicatorsUrls.includes(data["@id"])) {
        validatorWarnings.add(
          `Indicator <b>${data["@id"]}</b> does not exist in the Organization table`
        );
      }
    }
  }
}

function removeEmptyRows(tableData: TableInterface[]) {
  return tableData.filter((item) => item["@id"].length > 0);
}

function validateIfIdIsValidUrl(
  tableData: TableInterface[],
  operation: Operation
) {
  tableData.map((item) => {
    let tableName;
    try {
      tableName = item["@type"].split(":")[1];
    } catch (error) {
      validatorErrors.add(
        `<b>@type</b> on table <b>${item["@type"]}</b> must be present`
      );
    }

    try {
      new URL(item["@id"]);
    } catch (error) {
      if (operation === "import") {
        validatorWarnings.add(
          `Invalid URL format: <b>${item["@id"]}</b> for <b>@id</b> on table <b>${tableName}</b>`
        );
        return;
      }
      validatorErrors.add(
        `Invalid URL format: <b>${item["@id"]}</b> for <b>@id</b> on table <b>${tableName}</b>`
      );
      return;
    }
  });
}

function validateIfEmptyFile(tableData: TableInterface[]) {
  if (!Array.isArray(tableData) || tableData.length === 0) {
    validatorErrors.add("Table data is empty or not an array");
  }
}

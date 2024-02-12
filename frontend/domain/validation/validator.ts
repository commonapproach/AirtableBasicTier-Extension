import { TableInterface } from "../interfaces/table.interface";
import { map } from "../models";

let validatorErrors = new Set<string>();
let validatorWarnings = new Set<string>();
let indicatorsUrls = [];
export function validate(tableData: TableInterface[]): {
  errors: string[];
  warnings: string[];
} {
  validatorWarnings.clear();
  validatorErrors.clear();

  validateIfEmptyFile(tableData);

  validateIfIdIsValidUrl(tableData);

  tableData = removeEmptyRows(tableData);

  const tablesSet = new Set<any>();
  tableData.forEach((item) => {
    if (validateTypeProp(item)) return;
    tablesSet.add(item["@type"].split(":")[1]);
  });

  validateRecords(tableData);

  return {
    errors: Array.from(validatorErrors),
    warnings: Array.from(validatorWarnings),
  };
}

function validateRecords(tableData: TableInterface[]) {
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
        if (field.name === "i72:value") {
          if (Object.keys(data).includes("value")) {
            continue;
          }
        }
        validatorErrors.add(
          `Required field <b>${field.name}</b> is missing in table <b>${tableName}</b>`
        );
        console.warn(
          `Required field <b>${field.name}</b> is missing in table <b>${tableName}</b>`
        );
      }
    }

    for (const field of cid.getFields()) {
      if (field.semiRequired) {
        if (!Object.keys(data).includes(field.name)) {
          validatorWarnings.add(
            `Required field <b>${field.name}</b> is missing in table <b>${tableName}</b>`
          );
          console.warn(
            `Required field <b>${field.name}</b> is missing in table <b>${tableName}</b>`
          );
        }
        // @ts-ignore
        if (data[field.name]?.length === 0) {
          validatorWarnings.add(
            `Field <b>${field.name}</b> is empty in table <b>${tableName}</b>`
          );
          console.warn(
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
        console.error(
          `Field <b>${field.name}</b> is null or empty in table <b>${tableName}</b>`
        );
      }
    }

    for (const [fieldName, fieldValue] of Object.entries(data)) {
      if (fieldName === "@context" || fieldName === "@type") continue;

      const fieldProps: any = cid.getFieldByName(fieldName);

      if (!fieldProps) {
        continue;
      }

      if (Array.isArray(fieldValue)) {
        // check if fieldValue has duplicate values
        const uniqueValues = new Set(fieldValue);
        if (uniqueValues.size !== fieldValue.length) {
          console.warn(
            `Duplicate values in field <b>${fieldName}</b> in table <b>${tableName}</b>`
          );
          validatorWarnings.add(
            `Duplicate values in field <b>${fieldName}</b> in table <b>${tableName}</b>`
          );
        }
      }

      // Handle 'i72' type fields
      if (fieldProps.type === "i72") {
        // if (!("numerical_value" in fieldValue)) {
        //   console.error(
        //     `Invalid value for i72 field ${fieldName}: ${fieldValue} in table ${tableName}`
        //   );
        //   validatorErrors.add(
        //     `Invalid value for i72 field <b>${fieldName}</b>: <b>${fieldValue}</b> in table <b>${tableName}</b>`
        //   );
        // }
      } else {
        // Validate primary keys
        if (fieldProps?.primary) {
          if (!validatePrimary(fieldValue as string)) {
            console.error(
              `Invalid primary key: ${fieldValue} for ${fieldName} on table ${tableName}`
            );
            validatorErrors.add(
              `Invalid primary key: <b>${fieldValue}</b> for <b>${fieldName}</b> on table <b>${tableName}</b>`
            );
          }
        }

        // Validate unique fields
        if (fieldProps?.unique) {
          if (
            !validateUnique(tableName, fieldName, fieldValue, uniqueRecords, id)
          ) {
            console.error(
              `Duplicate value for unique field ${fieldName}: ${fieldValue} in table ${tableName}`
            );
            validatorErrors.add(
              `Duplicate value for unique field <b>${fieldName}</b>: <b>${fieldValue}</b> in table <b>${tableName}</b>`
            );
          }
        }

        if (fieldProps?.notNull) {
          if (fieldValue === "" || !fieldValue) {
            console.warn(
              `Null value for notNull field ${fieldName} in table ${tableName}`
            );
            validatorWarnings.add(
              `Field <b>${fieldName}</b> on table <b>${tableName}</b> is null or empty.`
            );
          }
        }

        if (fieldProps?.required) {
          if (fieldValue === "" || !fieldValue) {
            console.warn(
              `field ${fieldName} is required in table ${tableName}`
            );
            validatorWarnings.add(
              `Field <b>${fieldName}</b> on table <b>${tableName}</b> is required.`
            );
          }
        }
      }
    }
  }
}

function validatePrimary(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
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
  const urlObject = new URL(id);
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
    validatorErrors.add(`Table <b>${tableName}</b> does not exist`);
    return true;
  }
  return false;
}

function validateIndicatorsInOrganizations(tableData: TableInterface[]) {
  for (const data of tableData) {
    if (validateTypeProp(data)) return;
    const tableName = data["@type"].split(":")[1];
    if (tableName == "Organization") {
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
        console.warn(
          `Indicator <b>${data["@id"]}</b> does not exist in the Organization table`
        );
      }
    }
  }
}

function removeEmptyRows(tableData: TableInterface[]) {
  const result = tableData.filter((item) => {
    if (item["@id"].length === 0) {
      console.log("FOUND EMPTY ID");
    } else {
      return item;
    }
  });

  return result;
}

function validateIfIdIsValidUrl(tableData: TableInterface[]) {
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
      validatorErrors.add(
        `<b>@id</b> on table <b>${tableName}</b> must be a valid URL data`
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

import { TableInterface } from "../interfaces/table.interface";
import { map } from "../models";

export function validate(tableData: TableInterface[]) {
  const tablesSet = new Set<any>();
  tableData.forEach((item) => {
    tablesSet.add(item["@type"].split(":")[1]);
  });

  validateDuplicateIds(tableData);
}

function validateDuplicateIds(tableData: TableInterface[]) {
  // Records to keep track of unique values
  const uniqueRecords: Record<string, Set<any>> = {};

  for (const data of tableData) {
    const tableName = data["@type"].split(":")[1];
    const cid = new map[tableName](); // Initialize the schema for the table

    // Initialize a record for this table if not already present
    if (!uniqueRecords[tableName]) {
      uniqueRecords[tableName] = new Set();
    }

    for (const [fieldName, fieldValue] of Object.entries(data)) {
      if (fieldName === "@context" || fieldName === "@type") continue;

      const fieldProps: any = cid.getFieldByName(fieldName);

      if (!fieldProps) {
        continue;
      }

      // Handle 'i72' type fields
      if (fieldProps.type === "i72") {
        console.log("i72 Field");
      } else {
        // Validate primary keys
        if (fieldProps?.primary) {
          if (!validatePrimary(fieldValue as string)) {
            console.error(
              `Invalid primary key: ${fieldValue} for ${fieldName} on ${tableName}`
            );
          }
        }

        // Validate unique fields
        if (fieldProps?.unique) {
          if (
            !validateUnique(tableName, fieldName, fieldValue, uniqueRecords)
          ) {
            console.error(
              `Duplicate value for unique field ${fieldName}: ${fieldValue} in table ${tableName}`
            );
          }
        }

        if (fieldProps?.notNull) {
          if (fieldValue === "" || !fieldValue) {
            console.error(
              `Null value for notNull field ${fieldName} in table ${tableName}`
            );
          }
        }

        if (fieldProps?.required) {
          if (fieldValue === "" || !fieldValue) {
            console.error(
              `field ${fieldName} is required in table ${tableName}`
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
  uniqueRecords: Record<string, Set<any>>
): boolean {
  // Unique key for this field in the format "tableName.fieldName"
  const uniqueKey = `${tableName}.${fieldName}`;

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

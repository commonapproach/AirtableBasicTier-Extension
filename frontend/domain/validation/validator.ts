import { TableInterface } from "../interfaces/table.interface";
import { map } from "../models";

let errors = new Set<string>();
let warnings = new Set<string>();
export function validate(tableData: TableInterface[]): {
  errors: string[];
  warnings: string[];
} {
  const tablesSet = new Set<any>();
  tableData.forEach((item) => {
    tablesSet.add(item["@type"].split(":")[1]);
  });

  validateRecords(tableData);

  return { errors: Array.from(errors), warnings: Array.from(warnings) };
}

function validateRecords(tableData: TableInterface[]) {
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
        // if (!("numerical_value" in fieldValue)) {
        //   console.error(
        //     `Invalid value for i72 field ${fieldName}: ${fieldValue} in table ${tableName}`
        //   );
        //   errors.add(
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
            errors.add(
              `Invalid primary key: <b>${fieldValue}</b> for <b>${fieldName}</b> on table <b>${tableName}</b>`
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
            errors.add(
              `Duplicate value for unique field <b>${fieldName}</b>: <b>${fieldValue}</b> in table <b>${tableName}</b>`
            );
          }
        }

        if (fieldProps?.notNull) {
          if (fieldValue === "" || !fieldValue) {
            console.warn(
              `Null value for notNull field ${fieldName} in table ${tableName}`
            );
            warnings.add(
              `Field <b>${fieldName}</b> on table <b>${tableName}</b> is null or empty.`
            );
          }
        }

        if (fieldProps?.required) {
          if (fieldValue === "" || !fieldValue) {
            console.warn(
              `field ${fieldName} is required in table ${tableName}`
            );
            warnings.add(
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

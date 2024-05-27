import { IntlShape } from "react-intl";
import { TableInterface } from "../interfaces/table.interface";
import { map } from "../models";

type Operation = "import" | "export";

let validatorErrors = new Set<string>();
let validatorWarnings = new Set<string>();
let indicatorsUrls = [];
export function validate(
  tableData: TableInterface[],
  operation: Operation = "export",
  intl: IntlShape
): {
  errors: string[];
  warnings: string[];
} {
  validatorWarnings.clear();
  validatorErrors.clear();

  validateIfEmptyFile(tableData, intl);

  validateIfIdIsValidUrl(tableData, operation, intl);

  tableData = removeEmptyRows(tableData);

  tableData.forEach((item) => {
    validateTypeProp(item, intl);
  });

  validateRecords(tableData, operation, intl);

  return {
    errors: Array.from(validatorErrors),
    warnings: Array.from(validatorWarnings),
  };
}

function validateRecords(
  tableData: TableInterface[],
  operation: Operation,
  intl: IntlShape
) {
  // Records to keep track of unique values
  const uniqueRecords: Record<string, Set<any>> = {};

  validateIndicatorsInOrganizations(tableData, intl);

  for (const data of tableData) {
    if (validateTypeProp(data, intl)) return;
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
            intl.formatMessage(
              {
                id: "validation.messages.missingRequiredField",
                defaultMessage: `Required field <b>{fieldName}</b> is missing on table <b>{tableName}</b>`,
              },
              { fieldName: field.name, tableName, b: (str) => `<b>${str}</b>` }
            )
          );
        } else {
          validatorErrors.add(
            intl.formatMessage(
              {
                id: "validation.messages.missingRequiredField",
                defaultMessage: `Required field <b>{fieldName}</b> is missing on table <b>{tableName}</b>`,
              },
              { fieldName: field.name, tableName, b: (str) => `<b>${str}</b>` }
            )
          );
        }
      }
    }

    for (const field of cid.getFields()) {
      if (field.semiRequired) {
        if (!Object.keys(data).includes(field.name)) {
          validatorWarnings.add(
            intl.formatMessage(
              {
                id: "validation.messages.missingRequiredField",
                defaultMessage: `Required field <b>{fieldName}</b> is missing on table <b>{tableName}</b>`,
              },
              { fieldName: field.name, tableName, b: (str) => `<b>${str}</b>` }
            )
          );
        }
        // @ts-ignore
        if (data[field.name]?.length === 0) {
          validatorWarnings.add(
            intl.formatMessage(
              {
                id: "validation.messages.emptyField",
                defaultMessage: `Field <b>{fieldName}</b> is empty on table <b>{tableName}</b>`,
              },
              {
                fieldName: field.name,
                tableName,
                b: (str) => `<b>${str}</b>`,
              }
            )
          );
        }
      }
    }

    // check if notNull fields are not null
    for (const field of cid.getFields()) {
      if (field.notNull && Object.keys(data)?.length === 0) {
        validatorErrors.add(
          intl.formatMessage(
            {
              id: "validation.messages.nullOrEmptyField",
              defaultMessage: `Field <b>{fieldName}</b> is null or empty on table <b>{tableName}</b>`,
            },
            {
              fieldName: field.name,
              tableName,
              b: (str) => `<b>${str}</b>`,
            }
          )
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
            intl.formatMessage(
              {
                id: "validation.messages.duplicateFieldValues",
                defaultMessage: `Duplicate values in field <b>{fieldName}</b> on table <b>{tableName}</b>`,
              },
              {
                fieldName,
                tableName,
                b: (str) => `<b>${str}</b>`,
              }
            )
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
            !validateUnique(
              tableName,
              fieldName,
              fieldValue,
              uniqueRecords,
              id,
              intl
            )
          ) {
            const msg = intl.formatMessage(
              {
                id: "validation.messages.duplicateUniqueFieldValue",
                defaultMessage: `Duplicate value for unique field <b>{fieldName}</b>: <b>{fieldValue}</b> in table <b>{tableName}</b>`,
              },
              {
                fieldName,
                fieldValue: `${fieldValue}`,
                tableName,
                b: (str) => `<b>${str}</b>`,
              }
            );
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
              intl.formatMessage(
                {
                  id: "validation.messages.warning.nullOrEmptyField",
                  defaultMessage: `Field <b>{fieldName}</b> on table <b>{tableName}</b> is null or empty.`,
                },
                {
                  fieldName,
                  tableName,
                  b: (str) => `<b>${str}</b>`,
                }
              )
            );
          }
        }

        if (fieldProps?.required) {
          if (fieldValue === "" || !fieldValue) {
            validatorWarnings.add(
              intl.formatMessage(
                {
                  id: "validation.messages.warning.missingRequiredField",
                  defaultMessage: `Field <b>{fieldName}</b> on table <b>{tableName}</b> is required.`,
                },
                {
                  fieldName,
                  tableName,
                  b: (str) => `<b>${str}</b>`,
                }
              )
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
  id: string,
  intl: IntlShape
): boolean {
  // Unique key for this field in the format "tableName.fieldName"
  if (!id) return false;
  let urlObject;

  try {
    urlObject = new URL(id);
  } catch (error) {
    validatorErrors.add(
      intl.formatMessage(
        {
          id: "validation.messages.invalidIdFormat",
          defaultMessage: `Invalid URL format: <b>{id}</b> for <b>@id</b> on table <b>{tableName}</b>`,
        },
        {
          id,
          tableName,
          b: (str) => `<b>${str}</b>`,
        }
      )
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

function validateTypeProp(data: any, intl: IntlShape): boolean {
  if (!("@type" in data)) {
    validatorErrors.add(
      intl.formatMessage({
        id: "validation.messages.missingTypeProperty",
        defaultMessage: "<b>@type</b> must be present in the data",
      })
    );
    return true;
  }
  if (data["@type"].length === 0) {
    validatorErrors.add(
      intl.formatMessage({
        id: "validation.messages.emptyTypeProperty",
        defaultMessage: "<b>@type</b> cannot be empty",
      })
    );
    return true;
  }
  try {
    data["@type"]?.split(":")[1].length === 0;
  } catch (error) {
    validatorErrors.add(
      intl.formatMessage({
        id: "validation.messages.invalidTypeProperty",
        defaultMessage:
          "<b>@type</b> must follow the format <b>cids:tableName</b>",
      })
    );
    return true;
  }
  const tableName = (data["@type"] as string)?.split(":")[1];
  if (!map[tableName]) {
    validatorWarnings.add(
      intl.formatMessage(
        {
          id: "validation.messages.unrecognizedTypeProperty",
          defaultMessage: `Table <b>{tableName}</b> is not recognized in the basic tier and will be ignored.`,
        },
        {
          tableName,
          b: (str) => `<b>${str}</b>`,
        }
      )
    );
    return true;
  }
  return false;
}

function validateIndicatorsInOrganizations(
  tableData: TableInterface[],
  intl: IntlShape
) {
  for (const data of tableData) {
    if (validateTypeProp(data, intl)) return;
    const tableName = data["@type"].split(":")[1];
    if (tableName == "Organization") {
      if (!data["hasIndicator"]) {
        validatorWarnings.add(
          intl.formatMessage(
            {
              id: "validation.messages.warning.orgHasNoIndicators",
              defaultMessage: `Organization <b>{orgName}</b> has no indicators`,
            },
            {
              orgName: (data["org:hasLegalName"] ||
                data["hasLegalName"]) as string,
              b: (str) => `<b>${str}</b>`,
            }
          )
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
    if (validateTypeProp(data, intl)) return;
    const tableName = data["@type"].split(":")[1];
    if (tableName == "Indicator") {
      // @ts-ignore
      if (data["@id"] && !indicatorsUrls.includes(data["@id"])) {
        validatorWarnings.add(
          intl.formatMessage(
            {
              id: "validation.messages.warning.wrongReferenceForIndicator",
              defaultMessage: `Indicator <b>{indicatorId}</b> does not exist in the Organization table`,
            },
            {
              indicatorId: data["@id"],
              b: (str) => `<b>${str}</b>`,
            }
          )
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
  operation: Operation,
  intl: IntlShape
) {
  tableData.map((item) => {
    let tableName;
    try {
      tableName = item["@type"].split(":")[1];
    } catch (error) {
      validatorErrors.add(
        intl.formatMessage({
          id: "validation.messages.missingTypeProperty",
          defaultMessage: "<b>@type</b> must be present in the data",
        })
      );
    }

    try {
      new URL(item["@id"]);
    } catch (error) {
      if (operation === "import") {
        validatorWarnings.add(
          intl.formatMessage(
            {
              id: "validation.messages.invalidIdFormat",
              defaultMessage: `Invalid URL format: <b>{id}</b> for <b>@id</b> on table <b>{tableName}</b>`,
            },
            {
              id: item["@id"],
              tableName,
              b: (str) => `<b>${str}</b>`,
            }
          )
        );
        return;
      }
      validatorErrors.add(
        intl.formatMessage(
          {
            id: "validation.messages.invalidIdFormat",
            defaultMessage: `Invalid URL format: <b>{id}</b> for <b>@id</b> on table <b>{tableName}</b>`,
          },
          {
            id: item["@id"],
            tableName,
            b: (str) => `<b>${str}</b>`,
          }
        )
      );
      return;
    }
  });
}

function validateIfEmptyFile(tableData: TableInterface[], intl: IntlShape) {
  if (!Array.isArray(tableData) || tableData.length === 0) {
    validatorErrors.add(
      intl.formatMessage({
        id: "validation.messages.dataIsEmptyOrNotArray",
        defaultMessage: "Table data is empty or not an array",
      })
    );
  }
}

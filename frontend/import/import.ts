/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-prototype-builtins */
import Base from "@airtable/blocks/dist/types/src/models/base";
import Record from "@airtable/blocks/dist/types/src/models/record";
import Table from "@airtable/blocks/dist/types/src/models/table";
import { IntlShape } from "react-intl";
import { TableInterface } from "../domain/interfaces/table.interface";
import { IndicatorReport, Organization, map } from "../domain/models";
import { validate } from "../domain/validation/validator";
import { createTables } from "../helpers/createTables";
import { executeInBatches } from "../utils";

let CREATED_FIELDS_IDS: { [key: string]: string } = {};
let CREATED_FIELDS_DATA: {
  tableName: string;
  internalId: string;
  externalId: string;
}[] = [];
let CURRENT_IMPORTING_ORG = "";

export async function importData(
  jsonData: any,
  base: Base,
  setDialogContent: (
    header: string,
    text: string,
    open: boolean,
    nextCallback?: () => void
  ) => void,
  setIsImporting: (value: boolean) => void,
  intl: IntlShape
) {
  // Check if the user has CREATOR permission
  if (!base.hasPermissionToCreateTable()) {
    setDialogContent(
      `${intl.formatMessage({
        id: "generics.error",
        defaultMessage: "Error",
      })}!`,
      "You don't have permission to create tables in this base, please contact the base owner to give you <b>CREATOR</b> permission.",
      true
    );
    setIsImporting(false);
    return;
  }

  if (validateIfEmptyFile(jsonData)) {
    setDialogContent(
      `${intl.formatMessage({
        id: "generics.error",
        defaultMessage: "Error",
      })}!`,
      "Table data is empty or not an array",
      true
    );
    setIsImporting(false);
    return;
  }

  if (!checkIfHasOneOrganization(jsonData)) {
    setDialogContent(
      `${intl.formatMessage({
        id: "generics.error",
        defaultMessage: "Error",
      })}!`,
      "You can't import without at least one organization.",
      true
    );
    setIsImporting(false);
    return;
  }

  if (!doAllRecordsHaveId(jsonData)) {
    setDialogContent(
      `${intl.formatMessage({
        id: "generics.error",
        defaultMessage: "Error",
      })}!`,
      "All records must have an <b>@id</b> property.",
      true
    );
    setIsImporting(false);
    return;
  }

  jsonData = removeDuplicatedLinks(jsonData);

  const jsonDataByOrgs = await splitJsonDataByOrganization(
    base,
    jsonData,
    intl
  );

  let allErrors = "";
  let allWarnings = "";

  // Check if json data is a valid json array
  Object.values(jsonDataByOrgs).forEach((item: any) => {
    if (!Array.isArray(item)) {
      setDialogContent(
        `${intl.formatMessage({
          id: "generics.error",
          defaultMessage: "Error",
        })}!`,
        "Invalid JSON data, please check the data and try again.",
        true
      );
      return;
    }

    // Validate JSON
    let { errors, warnings } = validate(item, "import", intl);

    warnings = [
      ...warnings,
      ...warnIfUnrecognizedFieldsWillBeIgnored(item, intl),
    ];

    allErrors = errors.join("<hr/>");
    allWarnings = warnings.join("<hr/>");
  });

  if (allErrors.length > 0) {
    setDialogContent(
      `${intl.formatMessage({
        id: "generics.error",
        defaultMessage: "Error",
      })}!`,
      allErrors,
      true
    );
    return;
  }

  if (allWarnings.length > 0) {
    setDialogContent(
      `${intl.formatMessage({
        id: "generics.warning",
        defaultMessage: "Warning",
      })}!`,
      allWarnings,
      true,
      () => {
        setDialogContent(
          `${intl.formatMessage({
            id: "generics.warning",
            defaultMessage: "Warning",
          })}!`,
          intl.formatMessage({
            id: "import.messages.warning.continue",
            defaultMessage: "<p>Do you want to import anyway?</p>",
          }),
          true,
          async () => {
            importFileData(
              base,
              jsonDataByOrgs,
              setDialogContent,
              setIsImporting,
              intl
            );
          }
        );
      }
    );
  } else {
    importFileData(
      base,
      jsonDataByOrgs,
      setDialogContent,
      setIsImporting,
      intl
    );
  }
}

async function importFileData(
  base: Base,
  jsonDataByOrgs: any,
  setDialogContent: any,
  setIsImporting: (v: boolean) => void,
  intl: IntlShape
) {
  setDialogContent(
    intl.formatMessage({
      id: "import.messages.wait",
      defaultMessage: "Wait a moment...",
    }),
    intl.formatMessage({
      id: "import.messages.importing",
      defaultMessage: "Importing data...",
    }),
    true
  );
  setIsImporting(true);
  for (const [orgId, item] of Object.entries(jsonDataByOrgs)) {
    try {
      // Ignore types/classes that are not recognized
      const filteredItems = Array.isArray(item)
        ? item.filter((data) =>
            Object.keys(map).includes(data["@type"].split(":")[1])
          )
        : item;
      await importByData(base, filteredItems, orgId, intl);
      CREATED_FIELDS_DATA = [];
      CREATED_FIELDS_IDS = {};
      CURRENT_IMPORTING_ORG = "";
    } catch (error) {
      setIsImporting(false);
      setDialogContent(
        intl.formatMessage({
          id: "generics.error",
          defaultMessage: "Error",
        }),
        error.message ||
          `${intl.formatMessage({
            id: "generics.error.message",
            defaultMessage: "Something went wrong",
          })}`,
        true
      );
      return;
    }
  }
  setDialogContent(
    `${intl.formatMessage({
      id: "generics.success",
      defaultMessage: "Success",
    })}!`,
    `${intl.formatMessage({
      id: "import.messages.success",
      defaultMessage: "Your data has been successfully imported.",
    })}`,
    true
  );
  setIsImporting(false);
}

async function importByData(
  base: Base,
  jsonData: any,
  orgId: string,
  intl: IntlShape
) {
  CURRENT_IMPORTING_ORG = orgId;
  // Create Tables if they don't exist
  await createTables(intl);

  // Write Simple Records to Tables
  await writeTable(base, jsonData);

  // Write Linked Records to Tables
  await writeTableLinked(base, jsonData);

  // Write user's extra fields
  await writeExtraFields(base);

  // Delete All old Records
  await deleteTableRecords(base, jsonData);
}

async function writeTable(
  base: Base,
  tableData: TableInterface[]
): Promise<void> {
  const recordBatches: {
    tableName: string;
    records: Array<{ fields: { [key: string]: unknown } }>;
  }[] = [];

  for (const data of tableData) {
    const tableName = data["@type"].split(":")[1];
    const recordId = data["@id"];
    const table = base.getTableByNameIfExists(tableName);

    let record: { [key: string]: unknown } = {};
    Object.entries(data).forEach(([key, value]) => {
      if (
        !checkIfFieldISRecognized(tableName, key) &&
        key !== "@type" &&
        key !== "@context" &&
        key !== "value" &&
        key !== "hasLegalName"
      ) {
        return;
      }
      if (key === "value") {
        key = "i72:value";
      }
      if (key === "hasLegalName") {
        key = "org:hasLegalName";
      }
      const cid = new map[tableName]();
      if (
        cid.getFieldByName(key)?.type !== "link" &&
        cid.getFieldByName(key)?.type &&
        key !== "@type" &&
        key !== "@context"
      ) {
        if (cid.getFieldByName(key)?.type === "i72" || key === "value") {
          record[key] =
            // @ts-ignore
            value?.numerical_value?.toString() ||
            value?.["i72:numerical_value"]?.toString();

          // Extract the unit_of_measure value
          let unit_of_measure =
            value?.["i72:unit_of_measure"] || value?.["unit_of_measure"];
          if (unit_of_measure) {
            record["i72:unit_of_measure"] = unit_of_measure;
          }
        } else {
          record[key] = value;
        }
      }
    });

    const batch = recordBatches.find((batch) => batch.tableName === tableName);
    if (batch) {
      batch.records.push({ fields: record });
    } else {
      recordBatches.push({ tableName, records: [{ fields: record }] });
    }
  }

  // Create records in batches using executeInBatches function
  for (const batch of recordBatches) {
    const table = base.getTableByNameIfExists(batch.tableName);
    await executeInBatches(batch.records, async (recordsBatch) => {
      const recordIds = await table.createRecordsAsync(recordsBatch);
      recordIds.forEach((id, index) => {
        const originalRecordId: any = recordsBatch[index].fields["@id"];
        CREATED_FIELDS_IDS[originalRecordId] = id;
        CREATED_FIELDS_DATA.push({
          tableName: batch.tableName,
          internalId: originalRecordId,
          externalId: id,
        });
      });
    });
  }
}

async function writeTableLinked(
  base: Base,
  tableData: TableInterface[]
): Promise<void> {
  const updates: {
    tableName: string;
    updates: Array<{ id: string; fields: { [key: string]: unknown } }>;
  }[] = [];

  for (const data of tableData) {
    const tableName = data["@type"].split(":")[1];
    const recordId = data["@id"];
    const table = base.getTableByNameIfExists(tableName);

    let record: { [key: string]: unknown } = {};
    let oldRecord: { [key: string]: unknown } = {};
    let id: string;

    for (let [key, value] of Object.entries(data)) {
      const cid = new map[tableName]();
      if (
        cid.getFieldByName(key)?.type === "link" &&
        key !== "@type" &&
        key !== "@context"
      ) {
        // Using the function to create the new array
        id = CREATED_FIELDS_IDS[recordId];
        if (!value) return;

        // @ts-ignore
        if (!Array.isArray(value)) value = [value];

        // remove duplicates from value
        value = [...new Set(value as string[])];

        const tbl = base.getTableByNameIfExists(tableName);
        const linkedFields = tbl.fields.filter(
          (field) => field.type === "multipleRecordLinks"
        );
        const records = (await tbl.selectRecordsAsync()).records;
        const filteredRecords = records.filter(
          (rcd) => rcd.getCellValueAsString("@id") === recordId
        );
        const oldRecordData = filteredRecords.filter((rcd) => rcd.id !== id)[0];
        const newRecordData = filteredRecords.filter((rcd) => rcd.id === id)[0];

        const mappedValues = value
          // @ts-ignore
          ?.filter((uri) => CREATED_FIELDS_IDS[uri])
          ?.map((uri) => CREATED_FIELDS_IDS[uri]);
        record[key] = mappedValues.map((id: string) => ({ id }));

        if (oldRecordData) {
          oldRecord[key] =
            // @ts-ignore
            oldRecordData?.getCellValue(key)?.map((item) => {
              return { id: item.id };
            }) || [];
        }
      }
    }

    if (id && oldRecord && Object.keys(oldRecord).length > 0) {
      const updateBatch = updates.find(
        (batch) => batch.tableName === tableName
      );
      if (updateBatch) {
        updateBatch.updates.push({ id, fields: oldRecord });
      } else {
        updates.push({ tableName, updates: [{ id, fields: oldRecord }] });
      }
    }

    if (id && Object.keys(record).length > 0) {
      const updateBatch = updates.find(
        (batch) => batch.tableName === tableName
      );
      if (updateBatch) {
        updateBatch.updates.push({ id, fields: record });
      } else {
        updates.push({ tableName, updates: [{ id, fields: record }] });
      }
    }
  }

  // Execute the updates in batches
  for (const updateBatch of updates) {
    const table = base.getTableByNameIfExists(updateBatch.tableName);
    await executeInBatches(updateBatch.updates, async (batch) => {
      await table.updateRecordsAsync(batch);
    });
  }
}

async function writeExtraFields(base: Base): Promise<void> {
  for (const { tableName, externalId, internalId } of CREATED_FIELDS_DATA) {
    const cid = new map[tableName]();
    const table = base.getTableByNameIfExists(tableName);
    const records = await table.selectRecordsAsync();
    const externalFields = table.fields;
    const internalFields = cid.getFields().map((item) => item.name);
    const diffs = externalFields.filter(
      (x) => !internalFields.includes(x.name)
    );

    for (const diff of diffs) {
      if (!Object.keys(map).includes(diff.name)) {
        for (const record of records.records) {
          if (record.name === internalId && record.id !== externalId) {
            let valueToBeUpdated = record?.getCellValue(diff.name);
            if (
              valueToBeUpdated &&
              (record.name.includes(CURRENT_IMPORTING_ORG) ||
                tableName === "Theme")
            ) {
              if (Array.isArray(valueToBeUpdated)) {
                valueToBeUpdated = valueToBeUpdated.map((item) => {
                  return { id: item.id };
                });
              }
              await table.updateRecordAsync(externalId, {
                [diff.name]: valueToBeUpdated,
              });
            }
          }
        }
      }
    }
  }
}

async function deleteTableRecords(
  base: Base,
  tableData: TableInterface[]
): Promise<void> {
  const tablesSet = new Set();
  const tableIds = [];
  tableData.forEach((item) => {
    tablesSet.add(item["@type"].split(":")[1]);
    tableIds.push(item["@id"]);
  });

  const allRecordsToBeDeleted: { table: Table; ids: string[] }[] = [];

  for (const tableName of Array.from(tablesSet)) {
    const table = base.getTableByNameIfExists(tableName as string);
    if (table) {
      const linkedRecordsRecriated = {};
      const records = (await table.selectRecordsAsync()).records;
      const recordsToBeDeletedIds: string[] = [];
      for (const record of records) {
        const recordId = record.getCellValueAsString("@id");
        if (
          !Object.values(CREATED_FIELDS_IDS).includes(record.id) &&
          tableIds.includes(recordId)
        ) {
          if (
            tableName === "Theme" ||
            recordId.includes(CURRENT_IMPORTING_ORG)
          ) {
            recordsToBeDeletedIds.push(record.id);
          }
        } else {
          if (!Object.values(CREATED_FIELDS_IDS).includes(record.id)) {
            appendNewInfoToUserRecords(table, record, linkedRecordsRecriated);
          }
        }
      }
      await moveFieldsReference(base, table.name, recordsToBeDeletedIds);
      allRecordsToBeDeleted.push({ table, ids: recordsToBeDeletedIds });
    }
  }

  for (const { table, ids } of allRecordsToBeDeleted) {
    await executeInBatches(ids, async (batch) => {
      await table.deleteRecordsAsync(batch);
    });
  }
}

async function moveFieldsReference(
  base: Base,
  tableName: string,
  recordsToBeDeletedIds: string[]
) {
  const allTables = base.tables;
  const table = base.getTableByNameIfExists(tableName);
  const records = (await table.selectRecordsAsync()).records;
  for (const record of records) {
    if (recordsToBeDeletedIds.includes(record.id)) {
      const oldRecord = record;

      let newRecord: Record;
      for (const rec of records) {
        if (rec.name === oldRecord.name && rec.id !== oldRecord.id) {
          newRecord = rec;
        }
      }

      for (const tbl of allTables) {
        const tblRecords = (await tbl.selectRecordsAsync()).records;
        const tblFields = tbl.fields;

        for (const field of tblFields) {
          if (
            field.type === "multipleRecordLinks"
            // @ts-ignore
            // && field.parentTable.name === tableName
          ) {
            for (const rec of tblRecords) {
              const linkedValues: any = rec.getCellValue(field.name) ?? [];
              let mergedData: any = [];
              for (let linkedValue of linkedValues) {
                if (linkedValue.id === oldRecord.id) {
                  linkedValue.id = newRecord.id;
                  mergedData = linkedValues.map((item) => {
                    return { id: item.id };
                  });
                }
              }
              if (mergedData.length > 0) {
                try {
                  await tbl.updateRecordAsync(rec.id, {
                    [field.name]: mergedData,
                  });
                } catch (error) {
                  // for now we are ignoring the error
                }
              }
            }
          }
        }
      }
    }
  }
}

async function splitJsonDataByOrganization(
  base: Base,
  jsonData: any,
  intl: IntlShape
) {
  const tableOrganizations = new Set();
  const fileOrganizations = new Set();

  const orgs = jsonData.filter(
    (item: any) => item["@type"] === "cids:Organization"
  );
  orgs.map((item: any) => {
    fileOrganizations.add(item["@id"]);
  });

  let organizationTable = base.getTableByNameIfExists("Organization");
  if (!organizationTable) {
    await createTables(intl);
    await writeTable(base, orgs);
  }

  organizationTable = base.getTableByNameIfExists("Organization");
  (await organizationTable.selectRecordsAsync()).records.forEach((record) => {
    tableOrganizations.add(record.getCellValueAsString("@id"));
  });

  const jsonDataByOrgs = {};
  Array.from(fileOrganizations).forEach((item: any) => {
    const records = [];
    jsonData.map((data) => {
      if (data["@id"].includes(item)) {
        records.push(data);
      }

      // Expeption for theme table to be added to all organizations
      if (data["@type"] === "cids:Theme") {
        records.push(data);
      }
    });
    jsonDataByOrgs[item] = records;
  });

  return jsonDataByOrgs;
}

async function appendNewInfoToUserRecords(
  table: Table,
  record: Record,
  linkedRecordsRecriated: any
) {
  let linkFields: string[] = [];
  for (const field of table.fields) {
    if (field.config.type === "multipleRecordLinks") {
      linkFields.push(field.name);
    }
  }
  for (const linkFieldName of linkFields) {
    const newIds = [];
    const parentTableName =
      // @ts-ignore
      record.selectLinkedRecordsFromCell(linkFieldName).parentTable.name;

    const oldValues: any = record?.getCellValue(linkFieldName);
    if (!oldValues) continue;

    for (const oldValue of oldValues) {
      newIds.push({ id: CREATED_FIELDS_IDS[oldValue.name] });
    }

    if (newIds) {
      linkedRecordsRecriated[parentTableName] = newIds;
    }
  }

  try {
    const val = removeEmptyArrays(removeUndefinedIds(linkedRecordsRecriated));
    if (Object.keys(val).length > 0) {
      await table.updateRecordAsync(record.id, val);
    }
  } catch (error) {
    // for now we are ignoring the error
  }

  function removeUndefinedIds(obj) {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      // Check if the value is an array
      if (Array.isArray(value)) {
        // Filter out objects where `id` is `undefined`
        const filtered = value.filter((item) => item.id !== undefined);
        // Update the accumulator with the filtered array
        acc[key] = filtered;
      } else {
        // If not an array, just copy the value as is
        acc[key] = value;
      }
      return acc;
    }, {});
  }

  function removeEmptyArrays(obj) {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (key in map) {
        return acc;
      }
      if (Array.isArray(value) && value.length > 0) {
        acc[key] = value;
      } else if (!Array.isArray(value)) {
        acc[key] = value;
      }
      return acc;
    }, {});
  }
}

const checkIfHasOneOrganization = (jsonData: any) => {
  const allTableNames = new Set();
  for (const data of jsonData) {
    try {
      if (!data["@type"]) continue;
      const tableName = data["@type"].split(":")[1];
      allTableNames.add(tableName);
    } catch (error) {
      return false;
    }
  }
  if (!Array.from(allTableNames).includes("Organization")) {
    return false;
  }
  return true;
};

function removeDuplicatedLinks(jsonData: any) {
  for (const data of jsonData) {
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        data[key] = [...new Set(value)];
      }
    }
  }
  return jsonData;
}

function validateIfEmptyFile(tableData: TableInterface[]) {
  if (!Array.isArray(tableData) || tableData.length === 0) {
    return true;
  }
}

function doAllRecordsHaveId(tableData: TableInterface[]) {
  for (const data of tableData) {
    if (data["@id"] === undefined) {
      return false;
    }
  }
  return true;
}

function warnIfUnrecognizedFieldsWillBeIgnored(
  tableData: TableInterface[],
  intl: IntlShape
) {
  const warnings = [];
  const classesSet = new Set();
  for (const data of tableData) {
    const tableName = data["@type"].split(":")[1];
    if (!Object.keys(map).includes(tableName)) {
      continue;
    }
    if (classesSet.has(tableName)) {
      continue;
    }
    classesSet.add(tableName);
    const cid = new map[tableName]();
    for (const key in data) {
      if (
        !checkIfFieldISRecognized(tableName, key) &&
        key !== "@type" &&
        key !== "@context" &&
        key !== "value" &&
        key !== "hasLegalName"
      ) {
        warnings.push(
          `${intl.formatMessage(
            {
              id: "import.messages.warning.unrecognizedField",
              defaultMessage: `Table <b>{tableName}</b> has unrecognized field <b>{filedName}</b>. This field will be ignored.`,
            },
            { tableName, filedName: key, b: (str) => `<b>${str}</b>` }
          )}`
        );
      }
    }
  }
  return warnings;
}

function checkIfFieldISRecognized(tableName: string, fieldName: string) {
  if (tableName === Organization.className && fieldName === "hasLegalName")
    return true;
  if (tableName === IndicatorReport.className && fieldName === "value")
    return true;
  const cid = new map[tableName]();
  return cid
    .getFields()
    .map((item) => item.name)
    .includes(fieldName);
}

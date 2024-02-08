/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-prototype-builtins */
import Base from "@airtable/blocks/dist/types/src/models/base";
import { TableInterface } from "../domain/interfaces/table.interface";
import { FieldType } from "@airtable/blocks/dist/types/src/types/field";
import { executeInBatches, getActualFieldType } from "../utils";
import { Organization, map } from "../domain/models";
import { validate } from "../domain/validation/validator";
import Record from "@airtable/blocks/dist/types/src/models/record";
import Table from "@airtable/blocks/dist/types/src/models/table";

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
  setIsImporting: (value: boolean) => void
) {
  // Check if the user has CREATOR permission
  if (!base.hasPermissionToCreateTable()) {
    setDialogContent(
      `Error!`,
      "You don't have permission to create tables in this base, please contact the base owner to give you <b>CREATOR</b> permission.",
      true
    );
    setIsImporting(false);
    return;
  }

  if (!checkIfHasOneOrganization(jsonData)) {
    setDialogContent(
      `Error!`,
      "You can't import without at least one organization.",
      true
    );
    setIsImporting(false);
    return;
  }

  const jsonDataByOrgs = await splitJsonDataByOrganization(base, jsonData);

  let allErrors = "";
  let allWarnings = "";

  // Check if json data is a valid json array
  Object.values(jsonDataByOrgs).forEach((item: any) => {
    if (!Array.isArray(item)) {
      setDialogContent(
        `Error!`,
        "Invalid JSON data, please check the data and try again.",
        true
      );
      return;
    }

    // Validate JSON
    const { errors, warnings } = validate(item);
    allErrors = errors.join("<hr/>");
    allWarnings = warnings.join("<hr/>");
  });

  if (allErrors.length > 0) {
    setDialogContent(`Error!`, allErrors, true);
    return;
  }

  if (allWarnings.length > 0) {
    setDialogContent(`Warning!`, allWarnings, true, () => {
      setDialogContent(
        `Warning!`,
        "<p>Do you want to import anyway?</p>",
        true,
        async () => {
          importFileData(
            base,
            jsonDataByOrgs,
            setDialogContent,
            setIsImporting
          );
        }
      );
    });
  } else {
    importFileData(base, jsonDataByOrgs, setDialogContent, setIsImporting);
  }
}

async function importFileData(
  base: Base,
  jsonDataByOrgs: any,
  setDialogContent: any,
  setIsImporting
) {
  setDialogContent("Wait a moment...", "Importing data...", true);
  setIsImporting(true);
  for (const [orgId, item] of Object.entries(jsonDataByOrgs)) {
    try {
      await importByData(base, item, orgId);
      CREATED_FIELDS_DATA = [];
      CREATED_FIELDS_IDS = {};
      CURRENT_IMPORTING_ORG = "";
    } catch (error) {
      setIsImporting(false);
      setDialogContent("Error", error.message || "Something went wrong", true);
      return;
    }
  }
  setDialogContent(
    `Success!`,
    "Your data has been successfully imported.",
    true
  );
  setIsImporting(false);
}

async function importByData(base: Base, jsonData: any, orgId: string) {
  CURRENT_IMPORTING_ORG = orgId;
  // Create Tables if they don't exist
  await createTables(base, jsonData);

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
  for (const data of tableData) {
    const tableName = data["@type"].split(":")[1];
    const recordId = data["@id"];
    const table = base.getTableByNameIfExists(tableName);

    let record = {};
    Object.entries(data).forEach(([key, value]) => {
      if (key === "i72:value") {
        key = "value";
      }
      const cid = new map[tableName]();
      if (
        cid.getFieldByName(key)?.type !== "link" &&
        cid.getFieldByName(key)?.type &&
        key !== "@type" &&
        key !== "@context"
      ) {
        if (cid.getFieldByName(key)?.type === "i72" || key === "i72:value") {
          record[key] =
            // @ts-ignore
            value?.numerical_value?.toString() ||
            value?.["i72:numerical_value"]?.toString();
        } else {
          record[key] = value;
        }
      }
    });

    const respId = await table.createRecordAsync(record);
    CREATED_FIELDS_IDS[recordId] = respId;
    CREATED_FIELDS_DATA.push({
      tableName,
      internalId: recordId,
      externalId: respId,
    });
  }
}

async function writeTableLinked(
  base: Base,
  tableData: TableInterface[]
): Promise<void> {
  for (const data of tableData) {
    const tableName = data["@type"].split(":")[1];
    const recordId = data["@id"];
    const table = base.getTableByNameIfExists(tableName);

    let record = {};
    let oldRecord = {};
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
        const oldRecord = filteredRecords.filter((rcd) => rcd.id !== id)[0];
        const newRecord = filteredRecords.filter((rcd) => rcd.id === id)[0];

        const mappedValues = value
          // @ts-ignore
          ?.filter((uri) => CREATED_FIELDS_IDS[uri])
          ?.map((uri) => CREATED_FIELDS_IDS[uri]);
        record[key] = mappedValues.map((id: string) => ({ id }));

        if (oldRecord) {
          oldRecord[key] =
            // @ts-ignore
            oldRecord?.getCellValue(key)?.map((item) => {
              return { id: item.id };
            }) || [];
        }
      }
    }

    if (id && oldRecord && Object.keys(oldRecord).length > 0) {
      const recordID = await table.updateRecordAsync(id, oldRecord);
    }

    if (id && record) {
      const recordID = await table.updateRecordAsync(id, record);
    }
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
              record.name.includes(CURRENT_IMPORTING_ORG)
            ) {
              if (Array.isArray(valueToBeUpdated)) {
                valueToBeUpdated = valueToBeUpdated.map((item) => {
                  return { id: item.id };
                });
              }
              console.log(table.name, {
                [diff.name]: valueToBeUpdated,
              });
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

async function createTables(
  base: Base,
  tableData: TableInterface[]
): Promise<void> {
  const structure = {};

  tableData.forEach((item) => {
    const tableName = item["@type"].split(":").pop();
    const cid = new map[tableName]();

    if (!structure[tableName]) {
      structure[tableName] = { fields: {} };
    }

    for (const key in item) {
      if (
        Object.hasOwnProperty.call(item, key) &&
        key !== "@context" &&
        key !== "@type"
      ) {
        structure[tableName].fields[key] = {
          type: cid.getFieldByName(key)?.type,
          link: cid.getFieldByName(key)?.link?.name,
        };
      }
    }
  });

  await checkIfCancreateTableFields(base, structure);
  await createTablesIfNotExist(base);
  await createTableFields(base, structure);
}

async function createTablesIfNotExist(base: Base): Promise<void> {
  for (const tableName of Object.keys(map)) {
    const table = base.getTableByNameIfExists(tableName);
    if (!table) {
      console.log(`creating table ${tableName}`);
      await base.createTableAsync(tableName, [
        { name: "@id", type: "singleLineText" as FieldType },
      ]);
    }
  }
}

async function checkIfCancreateTableFields(
  base: Base,
  structure: any
): Promise<void> {
  let error: string = "";
  Object.entries(structure).forEach(([tableName, values]: any) => {
    const vals = Object.entries(values.fields);
    const table = base.getTableByNameIfExists(tableName);
    for (const val of vals) {
      const [fieldName, fieldData]: any = val;
      if (table?.getFieldByNameIfExists(fieldName)) {
        if (
          getActualFieldType(fieldData.type) !==
          table?.getFieldByNameIfExists(fieldName).type
        ) {
          error += `Field Type Mismatch, please delete the field <b>${fieldName}</b> on table <b>${table.name}</b> and try again <hr/>`;
        }
      }
    }
  });

  if (error.length > 0) {
    throw new Error(error);
  }
}

async function createTableFields(base: Base, structure: any): Promise<void> {
  for (const data of Object.entries(structure)) {
    const [tableName, values]: any = data;
    const vals = Object.entries(values.fields);
    const table = base.getTableByNameIfExists(tableName);
    for (const val of vals) {
      const [fieldName, fieldData]: any = val;
      if (!table.getFieldByNameIfExists(fieldName)) {
        if (fieldData.type === "link") {
          let tableId = base.getTableByNameIfExists(fieldData.link)?.id;
          if (!tableId) {
            alert(`Error: Linked Table named ${fieldData.link} not found`);
          }
          if (fieldData.type) {
            console.log(`creating field ${fieldName} on table ${table.name}`);
            await table.createFieldAsync(
              fieldName,
              getActualFieldType(fieldData.type) as FieldType,
              {
                linkedTableId: tableId,
              }
            );
          }
        } else {
          if (fieldData.type) {
            console.log(`creating field ${fieldName} on table ${table.name}`);
            await table.createFieldAsync(
              fieldName,
              getActualFieldType(fieldData.type) as FieldType
            );
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
          tableName === "Theme" &&
          tableIds.includes(recordId)
        ) {
          recordsToBeDeletedIds.push(record.id);
        }
        if (
          !Object.values(CREATED_FIELDS_IDS).includes(record.id) &&
          recordId.includes(CURRENT_IMPORTING_ORG) &&
          tableIds.includes(recordId)
        ) {
          recordsToBeDeletedIds.push(record.id);
        } else {
          if (!Object.values(CREATED_FIELDS_IDS).includes(record.id)) {
            appendNewInfoToUserRecords(table, record, linkedRecordsRecriated);
          }
        }
      }
      await moveFieldsReference(base, table.name, recordsToBeDeletedIds);
      setTimeout(async () => {
        await executeInBatches(
          recordsToBeDeletedIds,
          async (batch) => await table.deleteRecordsAsync(batch)
        );
      }, 2000);
    }
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
                  console.log(error);
                }
              }
            }
          }
        }
      }
    }
  }
}

async function splitJsonDataByOrganization(base: Base, jsonData: any) {
  const tableOrganizations = new Set();
  const fileOrganizations = new Set();
  const organizationCid = new Organization();

  const orgs = jsonData.filter(
    (item: any) => item["@type"] === `cids:${organizationCid.name}`
  );
  orgs.map((item: any) => {
    fileOrganizations.add(item["@id"]);
  });

  let organizationTable = base.getTableByNameIfExists(organizationCid.name);
  if (!organizationTable) {
    await createTables(base, orgs);
    await writeTable(base, orgs);
  }

  organizationTable = base.getTableByNameIfExists(organizationCid.name);
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
    console.log(error);
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
    const tableName = data["@type"].split(":")[1];
    allTableNames.add(tableName);
  }
  if (!Array.from(allTableNames).includes(Organization.name)) {
    return false;
  }
  return true;
};

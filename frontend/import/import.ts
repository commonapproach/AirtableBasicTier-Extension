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
  ) => void
) {
  // Check if the user has CREATOR permission
  if (!base.hasPermissionToCreateTable()) {
    setDialogContent(
      `Error!`,
      "You don't have permission to create tables in this base, please contact the base owner to give you <b>CREATOR</b> permission.",
      true
    );
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
          importFileData(base, jsonDataByOrgs, setDialogContent);
        }
      );
    });
  } else {
    importFileData(base, jsonDataByOrgs, setDialogContent);
  }
}

async function importFileData(
  base: Base,
  jsonDataByOrgs: any,
  setDialogContent: any
) {
  setDialogContent("Wait a moment...", "Importing data...", true);
  for (const [orgId, item] of Object.entries(jsonDataByOrgs)) {
    try {
      await importByData(base, item, orgId, setDialogContent);
      CREATED_FIELDS_DATA = [];
      CREATED_FIELDS_IDS = {};
      CURRENT_IMPORTING_ORG = "";
    } catch (error) {
      setDialogContent("Error", error.message || "Something went wrong", true);
      return;
    }
  }
}

async function importByData(
  base: Base,
  jsonData: any,
  orgId: string,
  setDialogContent: any
) {
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

  setDialogContent(
    `Success!`,
    "Your data has been successfully imported.",
    true
  );
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
      const cid = new map[tableName]();
      if (
        cid.getFieldByName(key)?.type !== "link" &&
        cid.getFieldByName(key)?.type &&
        key !== "@type" &&
        key !== "@context"
      ) {
        if (cid.getFieldByName(key)?.type === "i72") {
          record[key] =
            // @ts-ignore
            value?.numerical_value || value?.["i72:numerical_value"];
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

        oldRecord[key] =
          // @ts-ignore
          oldRecord.getCellValue(key)?.map((item) => {
            return { id: item.id };
          }) || [];
      }
    }

    if (id && oldRecord) {
      const recordID = await table.updateRecordAsync(id, oldRecord);
    }

    if (id && record) {
      const recordID = await table.updateRecordAsync(id, record);
    }
  }
}

async function writeExtraFields(base: Base): Promise<void> {
  for (const { tableName, externalId } of CREATED_FIELDS_DATA) {
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
          const valueToBeUpdated = await record.getCellValue(diff.name);
          if (valueToBeUpdated && record.name.includes(CURRENT_IMPORTING_ORG)) {
            await table.updateRecordAsync(externalId, {
              [diff.name]: valueToBeUpdated,
            });
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
    const recordsToBeRecriated: Record[] = [];
    if (table) {
      const linkedRecordsRecriated = {};
      const records = (await table.selectRecordsAsync()).records;
      const recordsToBeDeletedIds: string[] = [];
      for (const record of records) {
        const recordId = record.getCellValueAsString("@id");
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
      setTimeout(async () => {
        await executeInBatches(
          recordsToBeDeletedIds,
          async (batch) => await table.deleteRecordsAsync(batch)
        );
      }, 2000);
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

    const oldValues: any = record.getCellValue(linkFieldName);
    if (!oldValues) continue;

    for (const oldValue of oldValues) {
      newIds.push({ id: CREATED_FIELDS_IDS[oldValue.name] });
    }

    linkedRecordsRecriated[parentTableName] = newIds;
  }

  await table.updateRecordAsync(record.id, linkedRecordsRecriated);
}

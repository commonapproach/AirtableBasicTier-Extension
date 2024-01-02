/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-prototype-builtins */
import Base from "@airtable/blocks/dist/types/src/models/base";
import {
  LinkedCellInterface,
  SimpleCellInterface,
  TableInterface,
} from "../domain/shared";
import { FieldType } from "@airtable/blocks/dist/types/src/types/field";
import { executeInBatches, getActualFieldType } from "../utils";
import {
  Indicator,
  IndicatorReport,
  Organization,
  Outcome,
  Theme,
} from "../domain/models";

const CREATED_FIELDS_IDS: { [key: string]: string } = {};

const map = {
  Organization: Organization,
  Theme: Theme,
  Outcome: Outcome,
  Indicator: Indicator,
  IndicatorReport: IndicatorReport,
};

export async function importData(jsonData: any, base: Base) {
  // Create Tables if they don't exist
  await createTables(base, jsonData);

  // Write Simple Records to Tables
  await writeTable(base, jsonData);

  // Write Linked Records to Tables
  await writeTableLinked(base, jsonData);

  // Delete All old Records
  await deleteTableRecords(base, jsonData);

  return true;
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
        key !== "@type" &&
        key !== "@context"
      ) {
        if (cid.getFieldByName(key)?.type === "i72") {
          // @ts-ignore
          record[key] = value?.numerical_value;
        } else {
          record[key] = value;
        }
      }
    });

    const respId = await table.createRecordAsync(record);
    CREATED_FIELDS_IDS[recordId] = respId;
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
    let id: string;
    Object.entries(data).forEach(([key, value]) => {
      const cid = new map[tableName]();
      if (
        cid.getFieldByName(key)?.type === "link" &&
        key !== "@type" &&
        key !== "@context"
      ) {
        // Using the function to create the new array
        id = CREATED_FIELDS_IDS[recordId];
        if (!value) return;

        const mappedValues = value
          // @ts-ignore
          ?.filter((uri) => CREATED_FIELDS_IDS[uri])
          ?.map((uri) => CREATED_FIELDS_IDS[uri]);
        record[key] = mappedValues.map((id: string) => ({ id }));
      }
    });

    const recordID = await table.updateRecordAsync(id, record);
    // CREATED_FIELDS_IDS[recordId] = recordID;
  }
}

async function createTables(
  base: Base,
  tableData: TableInterface[]
): Promise<void> {
  const tablesSet = new Set();
  tableData.forEach((item) => tablesSet.add(item["@type"].split(":")[1]));
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
  await createTableFields(base, structure);
  console.log(structure);
}

async function checkIfCancreateTableFields(
  base: Base,
  structure: any
): Promise<void> {
  Object.entries(structure).forEach(([tableName, values]: any) => {
    const vals = Object.entries(values.fields);
    const table = base.getTableByNameIfExists(tableName);
    for (const val of vals) {
      const [fieldName, fieldData]: any = val;
      if (table.getFieldByNameIfExists(fieldName)) {
        if (
          getActualFieldType(fieldData.type) !==
          table.getFieldByNameIfExists(fieldName).type
        ) {
          throw new Error(
            `Field Type Mismatch, please delete the field ${fieldName} on table ${table.name} and try again`
          );
        }
      }
    }
  });
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
          let tableId = base.getTableByNameIfExists(fieldData.link.name)?.id;
          if (!tableId) {
            alert(`Error: Linked Table named ${fieldData.link.name} not found`);
          }
          console.log(`creating field ${fieldName} on table ${table.name}`);
          await table.createFieldAsync(
            fieldName,
            getActualFieldType(fieldData.type) as FieldType,
            {
              linkedTableId: tableId,
            }
          );
        } else {
          await table.createFieldAsync(
            fieldName,
            getActualFieldType(fieldData.type) as FieldType
          );
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
  tableData.forEach((item) => tablesSet.add(item["@type"].split(":")[1]));

  for (const tableName of Array.from(tablesSet)) {
    const table = base.getTableByNameIfExists(tableName as string);
    if (table) {
      const records = (await table.selectRecordsAsync()).records;
      const recordsToBeDeletedIds: string[] = [];
      for (const record of records) {
        if (!Object.values(CREATED_FIELDS_IDS).includes(record.id)) {
          recordsToBeDeletedIds.push(record.id);
        }
      }
      await executeInBatches(recordsToBeDeletedIds, (batch) =>
        table.deleteRecordsAsync(batch)
      );
    }
  }
}

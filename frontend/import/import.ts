/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-prototype-builtins */
import Base from "@airtable/blocks/dist/types/src/models/base";
import Table from "@airtable/blocks/dist/types/src/models/table";
import { LinkedCellInterface, SimpleCellInterface, TableInterface } from "../domain/shared";
import { FieldType } from "@airtable/blocks/dist/types/src/types/field";
import { executeInBatches } from "../utils";

const SWITCHED_LINK_IDS: { [key: string]: string } = {};
const SWITCHED_TABLE_IDS: { [key: string]: string } = {};
const CREATED_FIELDS_IDS: string[] = [];

export async function importData(jsonData: any, base: Base) {
  // Create Tables if they don't exist
  for (const tableName in jsonData) {
    const table = base.getTableByNameIfExists(tableName);
    if (!table) {
      await createTable(base, jsonData[tableName]);
    }
  }

  // Check if it can Create Tables Fieds
  for (const tableName in jsonData) {
    const table = base.getTableByNameIfExists(tableName);
    if (table) {
      await checkIfCancreateTableFields(table, jsonData[tableName]);
    }
  }

  // Create Tables Fieds
  for (const tableName in jsonData) {
    const table = base.getTableByNameIfExists(tableName);
    if (table) {
      await createTableFields(base, table, jsonData[tableName]);
    }
  }

  // Write Simple Records to Tables
  for (const tableName in jsonData) {
    const table = base.getTableByNameIfExists(tableName);
    if (table) {
      await writeTable(table, jsonData[tableName]);
    }
  }

  // Write Linked Records to Tables
  for (const tableName in jsonData) {
    const table = base.getTableByNameIfExists(tableName);
    if (table) {
      await writeTableLinked(table, jsonData[tableName]);
    }
  }

  // Delete All old Records
  for (const tableName in jsonData) {
    const table = base.getTableByNameIfExists(tableName);
    if (table) {
      await deleteTableRecords(table);
    }
  }

  return true;
}

async function writeTable(table: Table, data: TableInterface) {
  let simpleRows: { fields: { [key: string]: SimpleCellInterface } }[] = [];

  data.rows.forEach((row) => {
    let simpleRecords: { [key: string]: SimpleCellInterface } = {};

    Object.entries(row.fields).forEach(([key, value]) => {
      if (value.type !== "multipleRecordLinks") {
        simpleRecords[key] = value?.data as SimpleCellInterface;
        SWITCHED_LINK_IDS[row.recordId] = row.recordId;
      }
    });

    simpleRows.push({ fields: simpleRecords });
  });
  let createdIds: string[] = [];

  await executeInBatches(simpleRows, async (batch) => {
    const resp = await table.createRecordsAsync(batch);
    createdIds.push(...resp);
  });
  CREATED_FIELDS_IDS.push(...createdIds);

  data.rows.map((row, index) => {
    SWITCHED_LINK_IDS[row.recordId] = createdIds[index];
  });
}

async function writeTableLinked(table: Table, data: TableInterface) {
  let linkedRows: { id: string; fields: { [key: string]: LinkedCellInterface[] } }[] = [];

  data.rows.forEach((row) => {
    let linkedRecords: { [key: string]: LinkedCellInterface[] } = {};
    Object.entries(row.fields).forEach(([key, value]) => {
      if (value.type === "multipleRecordLinks") {
        linkedRecords[key] = value?.data as LinkedCellInterface[];
      }
    });
    linkedRows.push({ id: row.recordId, fields: linkedRecords });
  });

  linkedRows.map((row) => {
    row.id = SWITCHED_LINK_IDS[row.id];
    Object.entries(row.fields).forEach(([key, value]) => {
      value?.forEach((link: { id: string; name: string }) => {
        if (SWITCHED_LINK_IDS.hasOwnProperty(link.id)) {
          link.id = SWITCHED_LINK_IDS[link.id];
        }
      });
    });
  });

  await executeInBatches(linkedRows, (batch) => table.updateRecordsAsync(batch));
}

async function createTable(base: Base, tableData: TableInterface): Promise<void> {
  for (const field of tableData.fields) {
    if (field.isPrimary) {
      const resp = await base.createTableAsync(tableData.name, [{ name: field.name, type: field.type } as any]);
      SWITCHED_TABLE_IDS[tableData.id] = resp.id;
    }
  }
}

async function checkIfCancreateTableFields(table: Table, tableData: TableInterface): Promise<void> {
  for (const field of tableData.fields) {
    if (table.getFieldByNameIfExists(field.name)) {
      if (field.type !== table.getFieldByNameIfExists(field.name).type) {
        throw new Error(
          `Field Type Mismatch, please delete the field ${field.name} on table ${table.name} and try again`
        );
      }
    }
  }
}

async function createTableFields(base: Base, table: Table, tableData: TableInterface): Promise<void> {
  for (const field of tableData.fields) {
    if (!table.getFieldByNameIfExists(field.name)) {
      if (field.type === "multipleRecordLinks") {
        let tableId = base.getTableByNameIfExists(field.linkedTableName)?.id;
        if (!tableId) {
          alert(`Error: Linked Table named ${field.linkedTableName} not found`);
        }
        if (SWITCHED_TABLE_IDS.hasOwnProperty(field.linkedTableId)) {
          tableId = SWITCHED_TABLE_IDS[field.linkedTableId];
        }
        console.log(`creating field ${field.name} on table ${table.name}`);
        await table.createFieldAsync(field.name, field.type as FieldType, { linkedTableId: tableId });
      } else {
        await table.createFieldAsync(field.name, field.type as FieldType);
      }
    }
  }
}

async function deleteTableRecords(table: Table): Promise<void> {
  const records = (await table.selectRecordsAsync()).records;
  const recordsToBeDeletedIds: string[] = [];
  for (const record of records) {
    if (!CREATED_FIELDS_IDS.includes(record.id)) {
      recordsToBeDeletedIds.push(record.id);
    }
  }
  await executeInBatches(recordsToBeDeletedIds, (batch) => table.deleteRecordsAsync(batch));
}

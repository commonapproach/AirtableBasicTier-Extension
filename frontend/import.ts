import Base from "@airtable/blocks/dist/types/src/models/base";
import Table from "@airtable/blocks/dist/types/src/models/table";

const SWITCHED_LINK_IDS = {};

async function writeTable(table: Table, data: WriteTableInput) {
  let simpleRows = [];
  data.rows.forEach((row) => {
    let simpleRecords = {};
    Object.entries(row.fields).forEach(([key, value]) => {
      if (value.type !== "multipleRecordLinks") {
        simpleRecords[key] = value.data;
        SWITCHED_LINK_IDS[row.recordId] = row.recordId;
      }
    });
    simpleRows.push({ fields: simpleRecords });
  });
  const resp = await table.createRecordsAsync(simpleRows);

  data.rows.map((row, index) => {
    SWITCHED_LINK_IDS[row.recordId] = resp[index];
  });
}

async function writeTableLinked(table: Table, data: WriteTableInput) {
  let linkedRows = [];
  data.rows.forEach((row) => {
    let linkedRecords = {};
    Object.entries(row.fields).forEach(([key, value]) => {
      if (value.type === "multipleRecordLinks") {
        linkedRecords[key] = value.data;
      }
    });
    linkedRows.push({ id: row.recordId, fields: linkedRecords });
  });

  linkedRows.map((row) => {
    row.id = SWITCHED_LINK_IDS[row.id];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Object.entries(row.fields).forEach(([key, value]: any) => {
      value?.forEach((link: { id: string; name: string }) => {
        // eslint-disable-next-line no-prototype-builtins
        if (SWITCHED_LINK_IDS.hasOwnProperty(link.id)) {
          link.id = SWITCHED_LINK_IDS[link.id];
        }
      });
    });
  });

  await table.updateRecordsAsync(linkedRows);
}

export async function importData(data: any, base: Base) {
  for (const tableName in data) {
    const table = base.getTableByNameIfExists(tableName);
    if (table) {
      await writeTable(table, data[tableName]);
    }
  }
  for (const tableName in data) {
    const table = base.getTableByNameIfExists(tableName);
    if (table) {
      await writeTableLinked(table, data[tableName]);
    }
  }
}

export type WriteRow = {
  fields: {
    "@id": {
      type: string;
      data: string | { id: string; name: string }[];
    };
    [key: string]: any;
  };
  recordId: string;
};

type WriteTableInput = {
  id: string;
  name: string;
  rows: WriteRow[];
};

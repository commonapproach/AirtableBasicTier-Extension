import Table from "@airtable/blocks/dist/types/src/models/table";

export function writeTable(table: Table, data: WriteRow[]) {
  table.createRecordsAsync(data);
}

export function importData(data: any, base: any) {
  for (const tableName in data) {
    const table = base.getTableByNameIfExists(tableName);
    if (table) {
      writeTable(table, data[tableName]);
    }
  }
}

export type WriteRow = {
  fields: {
    "@id": string;
    [key: string]: string | number | LinkedField[];
  };
};

export type LinkedField = {
  id: string;
};

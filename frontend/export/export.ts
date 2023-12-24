import Base from "@airtable/blocks/dist/types/src/models/base";
import Table from "@airtable/blocks/dist/types/src/models/table";
import { downloadJSONLD } from "../utils";
import { CellDataInterface, RecordInterface } from "../domain/shared";

export async function exportData(base: Base): Promise<void> {
  let data = {};
  for (const table of base.tables) {
    data[table.name] = {
      id: table.id,
      name: table.name,
      rows: await readTable(table),
      fields: table.fields.map((field) => ({
        name: field.name,
        type: field.type,
        isPrimary: field.isPrimaryField,
        linkedTableId: field.options?.linkedTableId,
        linkedTableName: base.getTableByIdIfExists(field.options?.linkedTableId as string)?.name,
      })),
    };
  }
  const timestamp = new Date().toISOString();
  downloadJSONLD(data, `${base.name}-${timestamp}.jsonld`);
}

async function readTable(table: Table): Promise<RecordInterface[]> {
  const records = (await table.selectRecordsAsync()).records;
  const fields = table?.fields;

  let rows: RecordInterface[] = [];
  for (const record of records) {
    let row: RecordInterface = { fields: {}, recordId: "" } as any;

    for (const field of fields) {
      row.fields[field.name] = {
        "@context": field?.options?.linkedTableId as unknown as string,
        type: field.type,
        data: record.getCellValue(field) as CellDataInterface,
        createdAt: record.createdTime as unknown as string,
        isPrimary: field.isPrimaryField,
      };
      row.recordId = record.id;
    }

    rows.push(row);
  }

  return rows;
}

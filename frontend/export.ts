import Base from "@airtable/blocks/dist/types/src/models/base";
import Table from "@airtable/blocks/dist/types/src/models/table";
// import { write } from "./import";

export async function readTable(table: Table) {
  const records = (await table.selectRecordsAsync()).records;

  let rows = [];
  for (const record of records) {
    let row = { fields: {}, recordId: record.id };
    for (const header of table.fields) {
      row.fields[header.name] = {
        "@context": header?.options?.linkedTableId,
        type: header.type,
        data: record.getCellValue(header),
        createdAt: record.createdTime,
      };
    }
    rows.push(row);
  }

  return rows;
}

export async function exportData(base: Base) {
  let data = {};
  // const tables = [base.getTableByNameIfExists("Theme")];
  // for (const table of tables) {
  //   data[table.name] = {
  //     id: table.id,
  //     name: table.name,
  //     rows: await readTable(table),
  //   };
  // }
  for (const table of base.tables) {
    data[table.name] = {
      id: table.id,
      name: table.name,
      rows: await readTable(table),
    };
  }
  const timestamp = new Date().toISOString();
  downloadJSONLD(data, `${base.name}-${timestamp}.jsonld`);
  return data;
}

function downloadJSONLD(data: any, filename: string): void {
  const jsonldString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonldString], { type: "application/ld+json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

import Base from "@airtable/blocks/dist/types/src/models/base";
import { downloadJSONLD } from "../utils";
import { LinkedCellInterface } from "../domain/shared";
import {
  Indicator,
  IndicatorReport,
  Organization,
  Outcome,
  Theme,
} from "../domain/models";

const map = {
  Organization: Organization,
  Theme: Theme,
  Outcome: Outcome,
  Indicator: Indicator,
  IndicatorReport: IndicatorReport,
};

export async function exportData(base: Base): Promise<void> {
  const tables = base.tables;
  let data = [];

  for (const table of tables) {
    const records = (await table.selectRecordsAsync()).records;

    const cid = new map[table.name]();
    for (const record of records) {
      try {
        let row = {
          "@context": "https://schema.org/",
          "@type": `cids:${table.name}`,
        };
        for (const field of cid.getFields()) {
          if (field.type === "link") {
            const value = record.getCellValue(field.name);
            row[field.name] =
              //@ts-ignore
              value?.map((item: LinkedCellInterface) => item.name) ?? "";
          } else if (field.type === "i72") {
            row[field.name] = {
              "@context": "https://schema.org/",
              "@type": "i72:Measure",
              numerical_value: record.getCellValueAsString(field.name) ?? "",
            };
          } else {
            row[field.name] = record.getCellValue(field.name) ?? "";
          }
        }
        data.push(row);
      } catch (error) {
        console.log(table.name, record.name, error);
      }
    }
  }

  const timestamp = new Date().toISOString();
  downloadJSONLD(data, `${base.name}-${timestamp}.jsonld`);
}

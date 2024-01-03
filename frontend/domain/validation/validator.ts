import { TableInterface } from "../interfaces/table.interface";
import { map } from "../models";

export function validate(tableData: TableInterface[]) {
  const tablesSet = new Set<any>();
  tableData.forEach((item) => tablesSet.add(item["@type"].split(":")[1]));

  validateDuplicateIds(Array.from(tablesSet), tableData);
}

function validateDuplicateIds(
  tableNames: string[],
  tableData: TableInterface[]
) {
  for (const tableName of tableNames) {
    let cid = new map[tableName]();
    const ids: string[] = [];
    for (const data of tableData) {
      // console.log(data);
      // if (data["@type"].split(":")[1] === tableName) {
      //   const id = data["@id"];
      //   ids.push(id);
      // }
    }
    if (new Set(ids).size !== ids.length) {
      throw new Error(`Duplicate ids in ${tableName}`);
    }
  }
}

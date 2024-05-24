import { base } from "@airtable/blocks";
import { FieldType } from "@airtable/blocks/models";
import { map } from "../domain/models";
import { FieldType as LocalFiledType } from "../domain/models/Base";

export async function createTables() {
  const tablesOnBase = base.tables;
  const tableNamesOnBase = tablesOnBase.map((table) => table.name);
  const tablesToCreate = Object.keys(map);

  for (const tableToCreate of tablesToCreate) {
    let shouldCreateTable = true;
    for (const currentTable of tableNamesOnBase) {
      if (currentTable.toLowerCase() === tableToCreate.toLowerCase()) {
        if (currentTable !== tableToCreate) {
          throw new Error(
            `Please rename the table "${currentTable}" to "${tableToCreate}"`
          );
        }
        shouldCreateTable = false;
      }
    }
    if (!shouldCreateTable) {
      continue;
    }
    // Create table with @id field only
    await base.createTableAsync(tableToCreate, [
      {
        name: "@id",
        type: FieldType.SINGLE_LINE_TEXT,
      },
    ]);
  }

  for (const tableToCreate of tablesToCreate) {
    const tableClass = new map[tableToCreate]();
    const fields = tableClass
      .getFields()
      .filter((field: LocalFiledType) => field.type !== "link");
    await createFields(tableToCreate, fields);
  }

  for (const tableToCreate of tablesToCreate) {
    const tableClass = new map[tableToCreate]();
    const linkedFields = tableClass
      .getFields()
      .filter((field: LocalFiledType) => field.type === "link");
    for (const linkedField of linkedFields) {
      await createLinkedFields(
        tableToCreate,
        linkedField.name,
        linkedField.link.className,
        linkedField.name.startsWith("has")
          ? `for${tableToCreate}`
          : `has${tableToCreate}`
      );
    }
  }
}

async function createFields(
  tableName: string,
  fields: { name: string; type: string }[]
) {
  const table = base.getTableByNameIfExists(tableName);
  if (!table) {
    throw new Error(`Please, create table "${tableName}"`);
    return;
  }

  const fieldsOnTable = table.fields;
  const fieldNamesOnTable = fieldsOnTable.map((field) => field.name);

  for (const field of fields) {
    const fieldName = field.name;
    const getFieldType = () => {
      switch (field.type) {
        case "string":
          return FieldType.SINGLE_LINE_TEXT;
        case "i72":
          return FieldType.SINGLE_LINE_TEXT;
        case "text":
          return FieldType.MULTILINE_TEXT;
        case "link":
          return FieldType.MULTIPLE_RECORD_LINKS;
        default:
          return FieldType.SINGLE_LINE_TEXT;
      }
    };
    const fieldType = getFieldType();
    if (fieldNamesOnTable.includes(fieldName)) {
      const currentFieldType = fieldsOnTable.find(
        (field) => field.name === fieldName
      ).type;
      if (currentFieldType !== fieldType) {
        throw new Error(
          `Please update the field "${fieldName}" on table ${table.name} to be of type ${fieldType}`
        );
        return;
      }
      continue;
    }
    // need improvement
    const normalizedFieldName = normalizeFieldName(fieldName);
    const normalizedFieldNamesOnTable = fieldNamesOnTable.map((name) =>
      normalizeFieldName(name)
    );
    if (normalizedFieldNamesOnTable.includes(normalizedFieldName)) {
      throw new Error(
        `Please delete or rename the field "${fieldNamesOnTable.find(
          (name) => normalizeFieldName(name) === normalizedFieldName
        )}" to "${fieldName}" on table ${table.name}`
      );
      return;
    }
    await table.createFieldAsync(fieldName, fieldType);
  }
}

async function createLinkedFields(
  targetTableName: string,
  linkedFieldNameOnTargetTable: string,
  linkedTableName: string,
  linkedFieldNameOnLInkedTable: string
) {
  // Create linked field
  const table1 = base.getTableByNameIfExists(targetTableName);
  const table2 = base.getTableByNameIfExists(linkedTableName);

  if (!table1) {
    throw new Error(`Please, create table "${targetTableName}"`);
    return;
  }

  if (!table2) {
    throw new Error(`Please, create table "${linkedTableName}"`);
    return;
  }

  // check if linked field already exists
  const fieldsOnTable1 = table1.fields;
  const linkedFieldNameOnTable1 = normalizeFieldName(
    linkedFieldNameOnTargetTable
  );
  const fieldsOnTable2 = table2.fields;
  const linkedFieldNameOnTable2 = normalizeFieldName(
    linkedFieldNameOnLInkedTable
  );

  let linkedFieldTable1Id =
    fieldsOnTable1.find(
      (field) => normalizeFieldName(field.name) === linkedFieldNameOnTable1
    )?.id || null;

  let linkedFieldTable2Id =
    fieldsOnTable2.find(
      (field) => normalizeFieldName(field.name) === linkedFieldNameOnTable2
    )?.id || null;

  if (!linkedFieldTable1Id && !linkedFieldTable2Id) {
    await table1.createFieldAsync(
      linkedFieldNameOnTargetTable,
      FieldType.MULTIPLE_RECORD_LINKS,
      {
        linkedTableId: table2.id,
      }
    );
    const linkedFieldTable2 = table2.getFieldByName(table1.name);
    await linkedFieldTable2.updateNameAsync(linkedFieldNameOnLInkedTable);
  }

  if (linkedFieldTable1Id && !linkedFieldTable2Id) {
    throw new Error(
      `Please delete or rename the field "${
        table1.getFieldById(linkedFieldTable1Id).name
      }" on table ${table1.name}`
    );
    return;
  }

  if (!linkedFieldTable1Id && linkedFieldTable2Id) {
    throw new Error(
      `Please delete or rename the field "${
        table2.getFieldById(linkedFieldTable2Id).name
      }" on table ${table2.name}`
    );
    return;
  }

  if (linkedFieldTable1Id && linkedFieldTable2Id) {
    const linkedFieldTable1 = table1.getFieldByIdIfExists(linkedFieldTable1Id);
    const linkedFieldTable2 = table2.getFieldByIdIfExists(linkedFieldTable2Id);
    if (
      linkedFieldTable1 &&
      linkedFieldTable2 &&
      linkedFieldTable1.options.linkedTableId === table2.id &&
      linkedFieldTable2.options.linkedTableId === table1.id
    ) {
      return;
    }
    if (
      linkedFieldTable1 &&
      linkedFieldTable2 &&
      linkedFieldTable1.options.linkedTableId !== table2.id
    ) {
      throw new Error(
        `Please delete or rename the field "${
          table1.getFieldById(linkedFieldTable1Id).name
        }" on table ${table1.name}`
      );
      return;
    }
    if (
      linkedFieldTable1 &&
      linkedFieldTable2 &&
      linkedFieldTable2.options.linkedTableId !== table1.id
    ) {
      throw new Error(
        `Please delete or rename the field "${
          table2.getFieldById(linkedFieldTable2Id).name
        }" on table ${table2.name}`
      );
      return;
    }
  }
}

// Function to normalize field names
function normalizeFieldName(name: string): string {
  const lowerCaseName = name.toLowerCase();
  const prefixes = ["has", "for"];
  for (const prefix of prefixes) {
    if (lowerCaseName.startsWith(prefix)) {
      return lowerCaseName.slice(prefix.length).trim();
    }
  }
  return lowerCaseName;
}

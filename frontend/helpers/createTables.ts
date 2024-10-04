import { base } from "@airtable/blocks";
import { FieldType } from "@airtable/blocks/models";
import { IntlShape } from "react-intl";
import { map, ModelType } from "../domain/models";
import { FieldType as LocalFiledType } from "../domain/models/Base";
import { getActualFieldType } from "../utils";

export async function createTables(intl: IntlShape) {
	const tablesOnBase = base.tables;
	const tableNamesOnBase = tablesOnBase.map((table) => table.name);
	const tablesToCreate = Object.keys(map);

	for (const tableToCreate of tablesToCreate) {
		let shouldCreateTable = true;
		for (const currentTable of tableNamesOnBase) {
			if (currentTable.toLowerCase() === tableToCreate.toLowerCase()) {
				if (currentTable !== tableToCreate) {
					throw new Error(
						intl.formatMessage(
							{
								id: "createTables.messages.error.tableNameConflict",
								defaultMessage: `Please rename the table "{tableName}" to "{newTableName}"`,
							},
							{ tableName: currentTable, newTableName: tableToCreate }
						)
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

	// Create all regular fields
	for (const tableToCreate of tablesToCreate) {
		const tableClass = new map[tableToCreate as ModelType]();
		const fields = tableClass
			.getAllFields()
			.filter((field: LocalFiledType) => field.type !== "link" && field.type !== "object");
		await createFields(tableToCreate, fields, intl);
	}

	// Create all linked fields
	for (const tableToCreate of tablesToCreate) {
		const tableClass = new map[tableToCreate as ModelType]();
		const linkedFields = tableClass
			.getAllFields()
			.filter((field: LocalFiledType) => field.type === "link");
		for (const linkedField of linkedFields) {
			const fieldName = linkedField.displayName || linkedField.name;
			await createLinkedFields(
				tableToCreate,
				fieldName,
				linkedField.link.table.className,
				linkedField.link.field,
				intl
			);
		}
	}
}

async function createFields(tableName: string, fields: LocalFiledType[], intl: IntlShape) {
	const table = base.getTableByNameIfExists(tableName);
	if (!table) {
		throw new Error(
			intl.formatMessage(
				{
					id: "createTables.messages.error.createTable",
					defaultMessage: `Please, create table "{tableName}"`,
				},
				{ tableName }
			)
		);
	}

	const fieldsOnTable = table.fields;
	const fieldNamesOnTable = fieldsOnTable.map((field) => field.name);

	for (const field of fields) {
		if (field.type === "object") {
			await createFields(tableName, field.properties, intl);
			continue;
		}

		const fieldName = field.displayName || field.name;

		const fieldType = getActualFieldType(field.type);
		if (fieldNamesOnTable.includes(fieldName)) {
			const currentFieldType = fieldsOnTable.find((field) => field.name === fieldName).type;
			if (currentFieldType !== fieldType) {
				throw new Error(
					intl.formatMessage(
						{
							id: "createTables.messages.error.updateFieldType",
							defaultMessage: `Please update the field "{fieldName}" on table {tableName} to be of type {fieldType}`,
						},
						{ fieldName, tableName: table.name, fieldType }
					)
				);
			}
			continue;
		}

		const normalizedFieldName = normalizeFieldName(fieldName);
		const normalizedFieldNamesOnTable = fieldNamesOnTable.map((name) => normalizeFieldName(name));
		if (normalizedFieldNamesOnTable.includes(normalizedFieldName)) {
			throw new Error(
				intl.formatMessage(
					{
						id: "createTables.messages.error.renameField",
						defaultMessage: `Please delete or rename the field "{fieldName}" to "{newFieldName}" on table {tableName}`,
					},
					{
						fieldName: fieldNamesOnTable.find(
							(name) => normalizeFieldName(name) === normalizedFieldName
						),
						newFieldName: fieldName,
						tableName: table.name,
					}
				)
			);
		}

		let options = null;
		switch (fieldType) {
			case FieldType.SINGLE_SELECT:
				options = { choices: field.selectOptions.map((v) => ({ name: v.name })) || [] };
				break;
			case FieldType.DATE_TIME:
				options = {
					dateFormat: { name: "iso", format: "YYYY-MM-DD" },
					timeFormat: { name: "24hour", format: "HH:mm" },
					timeZone: "client",
				};
				break;
			case FieldType.DATE:
				options = { dateFormat: { name: "iso", format: "YYYY-MM-DD" } };
				break;
			default:
				break;
		}

		if (options) {
			await table.createFieldAsync(fieldName, fieldType, options);
		} else {
			await table.createFieldAsync(fieldName, fieldType);
		}
	}
}

async function createLinkedFields(
	targetTableName: string,
	linkedFieldNameOnTargetTable: string,
	linkedTableName: string,
	linkedFieldNameOnLInkedTable: string,
	intl: IntlShape
) {
	// Create linked field
	const table1 = base.getTableByNameIfExists(targetTableName);
	const table2 = base.getTableByNameIfExists(linkedTableName);

	if (!table1) {
		throw new Error(
			intl.formatMessage(
				{
					id: "createTables.messages.error.createTable",
					defaultMessage: `Please, create table "{tableName}"`,
				},
				{ tableName: targetTableName }
			)
		);
	}

	if (!table2) {
		throw new Error(
			intl.formatMessage(
				{
					id: "createTables.messages.error.createTable",
					defaultMessage: `Please, create table "{tableName}"`,
				},
				{ tableName: linkedTableName }
			)
		);
	}

	// check if linked field already exists
	const fieldsOnTable1 = table1.fields;
	const linkedFieldNameOnTable1 = normalizeFieldName(linkedFieldNameOnTargetTable);
	const fieldsOnTable2 = table2.fields;
	const linkedFieldNameOnTable2 = normalizeFieldName(linkedFieldNameOnLInkedTable);

	let linkedFieldTable1Id =
		fieldsOnTable1.find((field) => normalizeFieldName(field.name) === linkedFieldNameOnTable1)
			?.id || null;

	let linkedFieldTable2Id =
		fieldsOnTable2.find((field) => normalizeFieldName(field.name) === linkedFieldNameOnTable2)
			?.id || null;

	if (!linkedFieldTable1Id && !linkedFieldTable2Id) {
		await table1.createFieldAsync(linkedFieldNameOnTargetTable, FieldType.MULTIPLE_RECORD_LINKS, {
			linkedTableId: table2.id,
		});

		// If the linked filed is self-linked we don't need to check for the linked field on the other table
		if (linkedFieldNameOnTable1 === linkedFieldNameOnTable2 && table1.id === table2.id) {
			return;
		}

		const linkedFieldTable2 = table2.getFieldByName(table1.name);
		await linkedFieldTable2.updateNameAsync(linkedFieldNameOnLInkedTable);
	}

	if (linkedFieldTable1Id && !linkedFieldTable2Id) {
		throw new Error(
			intl.formatMessage(
				{
					id: "createTables.messages.error.wrongFieldType",
					defaultMessage: `Please delete or rename the field "{fieldName}" on table {tableName}`,
				},
				{
					fieldName: table1.getFieldById(linkedFieldTable1Id).name,
					tableName: table1.name,
				}
			)
		);
	}

	if (!linkedFieldTable1Id && linkedFieldTable2Id) {
		throw new Error(
			intl.formatMessage(
				{
					id: "createTables.messages.error.wrongFieldType",
					defaultMessage: `Please delete or rename the field "{fieldName}" on table {tableName}`,
				},
				{
					fieldName: table2.getFieldById(linkedFieldTable2Id).name,
					tableName: table2.name,
				}
			)
		);
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
				intl.formatMessage(
					{
						id: "createTables.messages.error.wrongFieldType",
						defaultMessage: `Please delete or rename the field "{fieldName}" on table {tableName}`,
					},
					{
						fieldName: table1.getFieldById(linkedFieldTable1Id).name,
						tableName: table1.name,
					}
				)
			);
		}
		if (
			linkedFieldTable1 &&
			linkedFieldTable2 &&
			linkedFieldTable2.options.linkedTableId !== table1.id
		) {
			throw new Error(
				intl.formatMessage(
					{
						id: "createTables.messages.error.wrongFieldType",
						defaultMessage: `Please delete or rename the field "{fieldName}" on table {tableName}`,
					},
					{
						fieldName: table2.getFieldById(linkedFieldTable2Id).name,
						tableName: table2.name,
					}
				)
			);
		}
	}
}

// Function to normalize field names, to handle possible variations of the standard field names
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

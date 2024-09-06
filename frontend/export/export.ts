import Base from "@airtable/blocks/dist/types/src/models/base";
import { Record } from "@airtable/blocks/models";
import moment from "moment-timezone";
import { IntlShape } from "react-intl";
import { LinkedCellInterface } from "../domain/interfaces/cell.interface";
import { ignoredFields, map, ModelType } from "../domain/models";
import { FieldType } from "../domain/models/Base";
import { validate } from "../domain/validation/validator";
import { downloadJSONLD } from "../utils";

export async function exportData(
	base: Base,
	setDialogContent: (
		header: string,
		text: string,
		open: boolean,
		nextCallback?: () => void
	) => void,
	orgName: string,
	intl: IntlShape
): Promise<void> {
	const tables = base.tables;
	let data = [];

	const tableNames = tables.map((item) => item.name);
	for (const [key] of Object.entries(map)) {
		if (!tableNames.includes(key)) {
			setDialogContent(
				`${intl.formatMessage({
					id: "generics.error",
					defaultMessage: "Error",
				})}!`,
				intl.formatMessage(
					{
						id: "export.messages.error.missingTable",
						defaultMessage: `Table <b>{tableName}</b> is missing. Please create the tables first.`,
					},
					{ tableName: key, b: (str) => `<b>${str}</b>` }
				),
				true
			);
			return;
		}
	}

	for (const table of tables) {
		// If the table is not in the map, skip it
		if (!Object.keys(map).includes(table.name)) {
			continue;
		}

		const records = (await table.selectRecordsAsync()).records;

		const cid = new map[table.name as ModelType]();
		for (const record of records) {
			let row = {
				"@context": "http://ontology.commonapproach.org/contexts/cidsContext.json",
				"@type": table.name === "Address" ? `ic:${table.name}` : `cids:${table.name}`,
			};
			let isEmpty = true; // Flag to check if the row is empty
			for (const field of cid.getTopLevelFields()) {
				if (field.type === "link") {
					const value: any = record.getCellValue(field.displayName || field.name);
					if (field.representedType === "array") {
						const fieldValue =
							value?.map((item: LinkedCellInterface) => item.name) ?? field?.defaultValue;
						if (fieldValue && fieldValue.length > 0) {
							isEmpty = false;
						}
						row[field.name] = fieldValue;
					} else if (field.representedType === "string") {
						const fieldValue = value ? value[0]?.name : field?.defaultValue;
						if (fieldValue) {
							isEmpty = false;
						}
						row[field.name] = fieldValue.toString();
					}
				} else if (field.type === "object") {
					const [newRow, newIsEmpty] = getObjectFieldsRecursively(record, field, row, isEmpty);
					row = { ...row, ...newRow };
					isEmpty = newIsEmpty;
				} else if (field.type === "select") {
					const fieldValue = record.getCellValue(field.displayName || field.name) ?? "";
					if (fieldValue && fieldValue["name"]) {
						isEmpty = false;
					}
					row[field.name] = fieldValue["name"];
				} else {
					const fieldValue = record.getCellValueAsString(field.displayName || field.name) ?? "";
					if (fieldValue) {
						isEmpty = false;
					}
					row[field.name] = fieldValue.toString();
				}
			}
			if (!isEmpty) {
				data.push(row);
			}
		}
	}

	const { errors, warnings } = validate(data, "export", intl);

	const emptyTableWarning = await checkForEmptyTables(base, intl);
	const allWarnings =
		checkForNotExportedFields(base, intl) + warnings.join("<hr/>") + emptyTableWarning;

	if (errors.length > 0) {
		setDialogContent(
			`${intl.formatMessage({
				id: "generics.error",
				defaultMessage: "Error",
			})}!`,
			errors.map((item) => `<p>${item}</p>`).join(""),
			true
		);
		return;
	}

	if (allWarnings.length > 0) {
		setDialogContent(
			`${intl.formatMessage({
				id: "generics.warning",
				defaultMessage: "Warning",
			})}!`,
			allWarnings,
			true,
			() => {
				setDialogContent(
					`${intl.formatMessage({
						id: "generics.warning",
						defaultMessage: "Warning",
					})}!`,
					intl.formatMessage({
						id: "export.messages.warning.continue",
						defaultMessage: "<p>Do you want to export anyway?</p>",
					}),
					true,
					() => {
						downloadJSONLD(data, `${getFileName(orgName)}.json`);
						setDialogContent("", "", false);
					}
				);
			}
		);
		return;
	}
	downloadJSONLD(data, `${getFileName(orgName)}.json`);
}

function getFileName(orgName: string): string {
	const date = new Date();

	// Get the year, month, and day from the date
	const year = date.getFullYear();
	const month = date.getMonth() + 1; // Add 1 because months are 0-indexed.
	const day = date.getDate();

	// Format month and day to ensure they are two digits
	const monthFormatted = month < 10 ? "0" + month : month;
	const dayFormatted = day < 10 ? "0" + day : day;

	// Concatenate the components to form the desired format (YYYYMMDD)
	const timestamp = `${year}${monthFormatted}${dayFormatted}`;

	return `CIDSBasic${orgName}${timestamp}`;
}

function checkForNotExportedFields(base: Base, intl: IntlShape) {
	let warnings = "";
	for (const table of base.tables) {
		if (!Object.keys(map).includes(table.name)) {
			continue;
		}
		const cid = new map[table.name as ModelType]();
		const internalFields = cid.getAllFields().map((item) => item.displayName || item.name);
		const externalFields = table.fields.map((item) => item.name);

		for (const field of externalFields) {
			if (Object.keys(map).includes(field) || ignoredFields[table.name]?.includes(field)) {
				continue;
			}
			if (!internalFields.includes(field)) {
				warnings += intl.formatMessage(
					{
						id: "export.messages.warning.fieldWillNotBeExported",
						defaultMessage: `Field <b>{fieldName}</b> on table <b>{tableName}</b> will not be exported<hr/>`,
					},
					{
						fieldName: field,
						tableName: table.name,
						b: (str) => `<b>${str}</b>`,
					}
				);
			}
		}
	}
	return warnings;
}

async function checkForEmptyTables(base: Base, intl: IntlShape) {
	let warnings = "";
	for (const table of base.tables) {
		if (!Object.keys(map).includes(table.name)) {
			continue;
		}
		const records = await table.selectRecordsAsync();
		if (records.records.length === 0) {
			warnings += intl.formatMessage(
				{
					id: "export.messages.warning.emptyTable",
					defaultMessage: `<hr/>Table <b>{tableName}</b> is empty<hr/>`,
				},
				{
					tableName: table.name,
					b: (str) => `<b>${str}</b>`,
				}
			);
		}
	}
	return warnings;
}

function getObjectFieldsRecursively(record: Record, field: FieldType, row: any, isEmpty: boolean) {
	if (field.type !== "object") {
		const value = record.getCellValue(field.displayName || field.name) ?? field.defaultValue;

		if (field.type === "link") {
			if (field.representedType === "array") {
				const fieldValue =
					value?.map((item: LinkedCellInterface) => item.name) ?? field?.defaultValue;
				if (fieldValue && fieldValue.length > 0) {
					isEmpty = false;
				}
				row[field.name] = fieldValue;
			} else if (field.representedType === "string") {
				const fieldValue = value ? value[0]?.name : field?.defaultValue;
				if (fieldValue) {
					isEmpty = false;
				}
				row[field.name] = fieldValue.toString();
			}
		} else if (field.type === "datetime") {
			if (value && typeof value === "string") {
				isEmpty = false;

				// break down the datetime object
				const date = moment.tz(value, "YYYY-MM-DDTHH:mm:ss", "UTC");
				const timezone = date.tz();

				row[field.name] = {
					"@context": "http://ontology.commonapproach.org/contexts/cidsContext.json",
					"@type": field.objectType,
					"time:timezone": timezone,
					"time:year": date.format("YYYY"),
					"time:month": date.format("MM"),
					"time:dayOfMonth": date.format("DD"),
					"time:hour": date.format("HH"),
					"time:minute": date.format("mm"),
					"time:second": date.format("ss"),
				};
			} else {
				row[field.name] = {
					"@context": "http://ontology.commonapproach.org/contexts/cidsContext.json",
					"@type": field.objectType,
					"time:timezone": "",
					"time:year": "",
					"time:month": "",
					"time:dayOfMonth": "",
					"time:hour": "",
					"time:minute": "",
					"time:second": "",
				};
			}
		} else {
			if (value) {
				isEmpty = false;
			}
			row[field.name] = value.toString();
		}
		return [row, isEmpty];
	}

	if (field.type === "object") {
		row[field.name] = {
			"@context": "http://ontology.commonapproach.org/contexts/cidsContext.json",
			"@type": field.objectType,
		};

		for (const property of field.properties) {
			// Call the function recursively
			const [newRow, newIsEmpty] = getObjectFieldsRecursively(
				record,
				property,
				row[field.name],
				isEmpty
			);
			row[field.name] = { ...row[field.name], ...newRow };
			isEmpty = newIsEmpty;
		}
	}

	return [row, isEmpty];
}

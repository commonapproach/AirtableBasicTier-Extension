import Base from "@airtable/blocks/dist/types/src/models/base";
import { Record } from "@airtable/blocks/models";
import moment from "moment-timezone";
import { IntlShape } from "react-intl";
import { CodeList, getCodeListByTableName } from "../domain/codeLists/getCodeLists";
import { LinkedCellInterface } from "../domain/interfaces/cell.interface";
import { contextUrl, ignoredFields, map, mapSFFModel, predefinedCodeLists } from "../domain/models";
import { FieldType } from "../domain/models/Base";
import { validate } from "../domain/validation/validator";
import { checkPrimaryField } from "../helpers/checkPrimaryField";
import { downloadJSONLD, getActualFieldType } from "../utils";

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

	let fullMap = map;

	// Check if any table of the SFF module is created
	const tableNamesOnBase = tables.map((table) => table.name);
	const sffModuleTables = Object.keys(mapSFFModel);
	if (sffModuleTables.some((table) => tableNamesOnBase.includes(table))) {
		fullMap = { ...map, ...mapSFFModel };
	}

	const tableNames = tables.map((item) => item.name);
	for (const [key] of Object.entries(fullMap)) {
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

	const primaryFieldErrors = await checkPrimaryField(base, intl);
	if (primaryFieldErrors.length > 0) {
		setDialogContent(
			`${intl.formatMessage({
				id: "generics.error",
				defaultMessage: "Error",
			})}!`,
			primaryFieldErrors.join("<hr/>"),
			true
		);
		return;
	}

	// Validate field types
	for (const table of tables) {
		if (!Object.keys(fullMap).includes(table.name)) {
			continue;
		}

		const cid = new fullMap[table.name]();
		for (const field of cid.getAllFields()) {
			const airtableField = table.fields.find((f) => f.name === (field.displayName || field.name));
			if (airtableField) {
				const expectedType = getActualFieldType(field.type);
				if (airtableField.type !== expectedType) {
					setDialogContent(
						`${intl.formatMessage({
							id: "generics.error",
							defaultMessage: "Error",
						})}!`,
						intl.formatMessage(
							{
								id: "export.messages.error.invalidFieldType",
								defaultMessage: `Field <b>{fieldName}</b> in table <b>{tableName}</b> has an invalid type. Expected type: <b>{expectedType}</b>. Please change the field type.`,
							},
							{
								fieldName: field.displayName || field.name,
								tableName: table.name,
								expectedType,
								b: (str) => `<b>${str}</b>`,
							}
						),
						true
					);
					return;
				}
			}
		}
	}

	const changeOnDefaultCodeListsWarning: string[] = [];

	for (const table of tables) {
		// If the table is not in the map, skip it
		if (!Object.keys(fullMap).includes(table.name)) {
			continue;
		}

		const records = (await table.selectRecordsAsync()).records;

		let codeList: CodeList[] | null = null;
		if (predefinedCodeLists.includes(table.name)) {
			codeList = await getCodeListByTableName(table.name);
		}

		const cid = new fullMap[table.name]();
		for (const record of records) {
			// Skip deleted records and records with no values
			if (record.isDeleted || !table.fields.some((field) => record.getCellValue(field.name))) {
				continue;
			}

			let row = {
				"@context": contextUrl,
				"@type": table.name === "Address" ? `ic:${table.name}` : `cids:${table.name}`,
			};

			let isEmpty = true; // Flag to check if the row is empty

			// Check if the record is in the predefined code list skip if it is
			// And show a warning message and skip if there are changes
			if (codeList && record.getCellValueAsString("@id")) {
				const existingItem = codeList.find(
					(item) => item["@id"] === record.getCellValueAsString("@id")
				);
				if (existingItem) {
					let hasChanges = false;
					for (const fieldName of Object.keys(existingItem)) {
						const recordValue = record.getCellValue(fieldName);
						const existingValue = existingItem[fieldName];

						if (recordValue !== existingValue) {
							hasChanges = true;
							break;
						}
					}
					if (hasChanges) {
						changeOnDefaultCodeListsWarning.push(
							intl.formatMessage(
								{
									id: "export.messages.warning.codeListChangesIgnored",
									defaultMessage: `Changes made in the predefined code list item with @id <b>{id}</b> in table <b>{tableName}</b> will be ignored.`,
								},
								{
									id: record.getCellValueAsString("@id"),
									tableName: table.name,
									b: (str) => `<b style="word-break: break-word;">${str}</b>`,
								}
							)
						);
					}
					continue;
				}
			}

			// If records has all values, except for the @id, equal to a code list item, warn the user
			if (codeList) {
				const existingItem = codeList.find((item) =>
					Object.keys(item).every(
						(key) => key === "@id" || record.getCellValueAsString(key) === item[key].toString()
					)
				);
				if (existingItem) {
					let hasChanges = false;
					for (const fieldName of Object.keys(existingItem)) {
						const recordValue = record.getCellValue(fieldName);
						const existingValue = existingItem[fieldName];

						if (recordValue !== existingValue) {
							hasChanges = true;
							break;
						}
					}
					if (hasChanges) {
						changeOnDefaultCodeListsWarning.push(
							intl.formatMessage(
								{
									id: "export.messages.warning.codeListSimilarItem",
									defaultMessage: `Record in table <b>{tableName}</b> with @id: <b>{recordId}</b> is similar to the predefined code list item with @id: <b>{codeListItemId}</b>.`,
								},
								{
									codeListItemId: existingItem["@id"],
									recordId: record.getCellValueAsString("@id"),
									tableName: table.name,
									b: (str) => `<b style="word-break: break-word;">${str}</b>`,
								}
							)
						);
					}
				}
			}

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
					let optionField;
					if (field.getOptionsAsync) {
						const options = await field.getOptionsAsync();
						optionField = options.find((opt) => opt.name === fieldValue["name"]);
					} else {
						optionField = field.selectOptions.find((opt) => opt.name === fieldValue["name"]);
					}
					if (optionField) {
						row[field.name] = field.representedType === "array" ? [optionField.id] : optionField.id;
					} else {
						row[field.name] =
							field.representedType === "array" ? [fieldValue["name"]] : fieldValue["name"];
					}
				} else if (field.type === "multiselect") {
					const fieldValue = record.getCellValue(field.displayName || field.name) ?? [];
					if (fieldValue && (fieldValue as { name: string }[]).length > 0) {
						isEmpty = false;
					}
					let optionField;
					if (field.getOptionsAsync) {
						const options = await field.getOptionsAsync();
						optionField = options.filter((opt) =>
							(fieldValue as { name: string }[]).map((item) => item.name).includes(opt.name)
						);
					} else {
						optionField = field.selectOptions.filter((opt) =>
							(fieldValue as { name: string }[]).map((item) => item.name).includes(opt.name)
						);
					}
					const recognizedOptionIds = optionField.map((opt) => opt.id);
					const unrecognizedOptionNames = (fieldValue as { name: string }[])
						.filter((item) => !optionField.map((opt) => opt.name).includes(item.name))
						.map((item) => item.name);
					row[field.name] =
						field.representedType === "array"
							? [...recognizedOptionIds, ...unrecognizedOptionNames]
							: [...recognizedOptionIds, ...unrecognizedOptionNames].join(", ");
				} else if (field.type === "datetime") {
					const fieldValue = record.getCellValueAsString(field.displayName || field.name) ?? "";
					if (fieldValue && typeof fieldValue === "string") {
						isEmpty = false;

						// get local timezone
						const localTimezone = moment.tz.guess();
						const date = moment(fieldValue).tz(localTimezone).format("YYYY-MM-DDTHH:mm:ssZ");

						row[field.name] = date;
					} else {
						row[field.name] = "";
					}
				} else if (field.type === "date") {
					const fieldValue = record.getCellValueAsString(field.displayName || field.name) ?? "";
					if (fieldValue && typeof fieldValue === "string") {
						isEmpty = false;

						// get local timezone
						const localTimezone = moment.tz.guess();
						const date = moment(fieldValue).tz(localTimezone).format("YYYY-MM-DD");

						row[field.name] = date;
					} else {
						row[field.name] = "";
					}
				} else if (field.type === "boolean") {
					const fieldValue = record.getCellValue(field.displayName || field.name) ?? false;
					row[field.name] = fieldValue ? true : false;
				} else {
					const fieldValue =
						record.getCellValue(field.displayName || field.name) ?? field.defaultValue;
					if (fieldValue) {
						isEmpty = false;
					}
					let exportValue = fieldValue;
					if (Array.isArray(fieldValue) && field.representedType === "array") {
						exportValue = fieldValue;
					} else if (!Array.isArray(fieldValue) && field.representedType === "array") {
						exportValue = fieldValue ? [fieldValue] : field.defaultValue;
					} else {
						exportValue = fieldValue ? fieldValue.toString() : field.defaultValue;
					}
					row[field.name] = exportValue;
				}
			}
			if (!isEmpty) {
				data.push(row);
			}
		}
	}

	const { errors, warnings } = await validate(data, "export", intl);

	const emptyTableWarning = await checkForEmptyTables(base, intl);
	const allWarnings = [
		...checkForNotExportedFields(base, intl),
		...warnings,
		...emptyTableWarning,
		...changeOnDefaultCodeListsWarning,
	].join("<hr/>");

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
	let warnings: string[] = [];
	const fullMap = { ...map, ...mapSFFModel };
	for (const table of base.tables) {
		if (!Object.keys(fullMap).includes(table.name)) {
			continue;
		}
		const cid = new fullMap[table.name]();
		const internalFields = cid.getAllFields().map((item) => item.displayName || item.name);
		const externalFields = table.fields.map((item) => item.name);

		for (const field of externalFields) {
			if (Object.keys(fullMap).includes(field) || ignoredFields[table.name]?.includes(field)) {
				continue;
			}
			if (!internalFields.includes(field)) {
				warnings.push(
					intl.formatMessage(
						{
							id: "export.messages.warning.fieldWillNotBeExported",
							defaultMessage: `Field <b>{fieldName}</b> on table <b>{tableName}</b> will not be exported`,
						},
						{
							fieldName: field,
							tableName: table.name,
							b: (str) => `<b>${str}</b>`,
						}
					)
				);
			}
		}
	}
	return warnings;
}

async function checkForEmptyTables(base: Base, intl: IntlShape) {
	let warnings: string[] = [];
	const fullMap = { ...map, ...mapSFFModel };
	for (const table of base.tables) {
		if (!Object.keys(fullMap).includes(table.name)) {
			continue;
		}
		const records = await table.selectRecordsAsync();
		if (records.records.length === 0) {
			warnings.push(
				intl.formatMessage(
					{
						id: "export.messages.warning.emptyTable",
						defaultMessage: `Table <b>{tableName}</b> is empty`,
					},
					{
						tableName: table.name,
						b: (str) => `<b>${str}</b>`,
					}
				)
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

				// get local timezone
				const localTimezone = moment.tz.guess();
				const date = moment(value).tz(localTimezone).format("YYYY-MM-DDTHH:mm:ssZ");

				row[field.name] = date;
			} else {
				row[field.name] = "";
			}
		} else if (field.type === "date") {
			if (value && typeof value === "string") {
				isEmpty = false;

				// get local timezone
				const localTimezone = moment.tz.guess();
				const date = moment(value).tz(localTimezone).format("YYYY-MM-DD");

				row[field.name] = date;
			} else {
				row[field.name] = "";
			}
		} else if (field.type === "boolean") {
			row[field.name] = value ? true : false;
		} else {
			if (value) {
				isEmpty = false;
			}
			let exportValue = value;
			if (Array.isArray(value) && field.representedType === "array") {
				exportValue = value;
			} else if (!Array.isArray(value) && field.representedType === "array") {
				exportValue = value ? [value] : field.defaultValue;
			} else {
				exportValue = value ? value.toString() : field.defaultValue;
			}
			row[field.name] = exportValue;
		}
		return [row, isEmpty];
	}

	if (field.type === "object") {
		row[field.name] = {
			"@context": contextUrl,
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

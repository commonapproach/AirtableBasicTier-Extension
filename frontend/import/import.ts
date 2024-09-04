/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-prototype-builtins */
import Base from "@airtable/blocks/dist/types/src/models/base";
import { IntlShape } from "react-intl";
import { TableInterface } from "../domain/interfaces/table.interface";
import { map, ModelType } from "../domain/models";
import { FieldType } from "../domain/models/Base";
import { validate } from "../domain/validation/validator";
import { createTables } from "../helpers/createTables";
import { executeInBatches } from "../utils";

export async function importData(
	jsonData: any,
	base: Base,
	setDialogContent: (
		header: string,
		text: string,
		open: boolean,
		nextCallback?: () => void
	) => void,
	setIsImporting: (value: boolean) => void,
	intl: IntlShape
) {
	// Check if the user has CREATOR permission
	if (!base.hasPermissionToCreateTable()) {
		setDialogContent(
			`${intl.formatMessage({
				id: "generics.error",
				defaultMessage: "Error",
			})}!`,
			intl.formatMessage({
				id: "import.messages.error.wrongPermissionLevel",
				defaultMessage:
					"You don't have permission to create tables in this base, please contact the base owner to give you <b>CREATOR</b> permission.",
			}),
			true
		);
		setIsImporting(false);
		return;
	}

	if (validateIfEmptyFile(jsonData)) {
		setDialogContent(
			`${intl.formatMessage({
				id: "generics.error",
				defaultMessage: "Error",
			})}!`,
			intl.formatMessage({
				id: "import.messages.error.emptyOrNotArray",
				defaultMessage: "Table data is empty or not an array",
			}),
			true
		);
		setIsImporting(false);
		return;
	}

	if (!doAllRecordsHaveId(jsonData)) {
		setDialogContent(
			`${intl.formatMessage({
				id: "generics.error",
				defaultMessage: "Error",
			})}!`,
			intl.formatMessage({
				id: "import.messages.error.missingId",
				defaultMessage: "All records must have an <b>@id</b> property.",
			}),
			true
		);
		setIsImporting(false);
		return;
	}

	jsonData = removeDuplicatedLinks(jsonData);

	let allErrors = "";
	let allWarnings = "";

	// Check if json data is a valid json array
	if (!Array.isArray(jsonData)) {
		setDialogContent(
			`${intl.formatMessage({
				id: "generics.error",
				defaultMessage: "Error",
			})}!`,
			intl.formatMessage({
				id: "import.messages.error.invalidJson",
				defaultMessage: "Invalid JSON data, please check the data and try again.",
			}),
			true
		);
		return;
	}

	// Transform object field if it's in the wrong format
	jsonData = transformObjectFieldIfWrongFormat(jsonData);

	// Validate JSON
	let { errors, warnings } = validate(jsonData, "import", intl);

	warnings = [...warnings, ...warnIfUnrecognizedFieldsWillBeIgnored(jsonData, intl)];

	allErrors = errors.join("<hr/>");
	allWarnings = warnings.join("<hr/>");

	if (allErrors.length > 0) {
		setDialogContent(
			`${intl.formatMessage({
				id: "generics.error",
				defaultMessage: "Error",
			})}!`,
			allErrors,
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
						id: "import.messages.warning.continue",
						defaultMessage: "<p>Do you want to import anyway?</p>",
					}),
					true,
					async () => {
						importFileData(base, jsonData, setDialogContent, setIsImporting, intl);
					}
				);
			}
		);
	} else {
		importFileData(base, jsonData, setDialogContent, setIsImporting, intl);
	}
}

async function importFileData(
	base: Base,
	jsonData: any,
	setDialogContent: any,
	setIsImporting: (v: boolean) => void,
	intl: IntlShape
) {
	setDialogContent(
		intl.formatMessage({
			id: "import.messages.wait",
			defaultMessage: "Wait a moment...",
		}),
		intl.formatMessage({
			id: "import.messages.importing",
			defaultMessage: "Importing data...",
		}),
		true
	);
	setIsImporting(true);
	try {
		// Ignore types/classes that are not recognized
		const filteredItems = Array.isArray(jsonData)
			? jsonData.filter((data) => Object.keys(map).includes(data["@type"].split(":")[1]))
			: jsonData;
		await importByData(base, filteredItems, intl);
	} catch (error) {
		console.log("error", error);
		setIsImporting(false);
		setDialogContent(
			intl.formatMessage({
				id: "generics.error",
				defaultMessage: "Error",
			}),
			error.message ||
				`${intl.formatMessage({
					id: "generics.error.message",
					defaultMessage: "Something went wrong",
				})}`,
			true
		);
		return;
	}
	setDialogContent(
		`${intl.formatMessage({
			id: "generics.success",
			defaultMessage: "Success",
		})}!`,
		`${intl.formatMessage({
			id: "import.messages.success",
			defaultMessage: "Your data has been successfully imported.",
		})}`,
		true
	);
	setIsImporting(false);
}

async function importByData(base: Base, jsonData: any, intl: IntlShape) {
	// Create Tables if they don't exist
	await createTables(intl);

	// Write Simple Records to Tables
	await writeTable(base, jsonData);

	// Write Linked Records to Tables
	await writeTableLinked(base, jsonData);
}

async function writeTable(base: Base, tableData: TableInterface[]): Promise<void> {
	const recordBatches: {
		tableName: string;
		records: Array<{ fields: { [key: string]: unknown } }>;
	}[] = [];

	for (const data of tableData) {
		const tableName = data["@type"].split(":")[1];

		let record: { [key: string]: unknown } = {};
		Object.entries(data).forEach(([key, value]) => {
			if (key !== "@type" && key !== "@context" && !checkIfFieldIsRecognized(tableName, key)) {
				return;
			}

			const cid = new map[tableName as ModelType]();

			for (const field of cid.getAllFields()) {
				if (field.name.includes(":") && field.name.split(":")[1] === key) {
					key = field.name;
					break;
				}
			}

			if (cid.getFieldByName(key)?.type !== "link" && cid.getFieldByName(key)?.type) {
				if (cid.getFieldByName(key)?.type === "object") {
					record = findLastFieldValueForNestedFields(data, cid.getFieldByName(key), record);
				} else {
					const field = cid.getFieldByName(key);
					const fieldName = field.displayName || field.name;
					record[fieldName] = value ? value.toString() : value;
				}
			}
		});

		const batch = recordBatches.find((batch) => batch.tableName === tableName);
		if (batch) {
			batch.records.push({ fields: record });
		} else {
			recordBatches.push({ tableName, records: [{ fields: record }] });
		}
	}

	// Execute the updates or creates in batches
	for (const batch of recordBatches) {
		const table = base.getTableByNameIfExists(batch.tableName);
		await executeInBatches(batch.records, async (recordsBatch) => {
			// check if the record already exists
			const records = (await table.selectRecordsAsync()).records;
			const recordsToBeUpdated = [];
			const recordsToBeCreated = [];
			for (const record of recordsBatch) {
				const recordExists = records.find(
					(rcd) => rcd.getCellValueAsString("@id") === record.fields["@id"]
				);
				if (recordExists) {
					recordsToBeUpdated.push({ id: recordExists.id, fields: record.fields });
				} else {
					recordsToBeCreated.push(record);
				}
			}
			if (recordsToBeUpdated.length > 0) {
				await table.updateRecordsAsync(recordsToBeUpdated);
			}
			if (recordsToBeCreated.length > 0) {
				await table.createRecordsAsync(recordsToBeCreated);
			}
		});
	}
}

async function writeTableLinked(base: Base, tableData: TableInterface[]): Promise<void> {
	async function handleLinkFields(tableName: string, key: string, value: any, recordId: string) {
		const cid = new map[tableName as ModelType]();
		const field = cid.getFieldByName(key);

		if (!value) return; // Skip if the value is empty

		// @ts-ignore
		if (!Array.isArray(value)) value = [value];

		// remove duplicates from value
		value = [...new Set(value as string[])];

		// get ids from linked table
		const linkedTable = base.getTableByNameIfExists(cid.getFieldByName(key)?.link.table.className);
		if (!linkedTable) return;
		const linkedRecords = (await linkedTable.selectRecordsAsync()).records;

		// set the internal id to the value
		value = value.reduce((acc, val) => {
			const record = linkedRecords.find((rcd) => rcd.getCellValueAsString("@id") === val);
			if (record) {
				acc.push(record.id);
			}
			return acc;
		}, []);

		// Check if the field exists in the table
		const tbl = base.getTableByNameIfExists(tableName);
		const records = (await tbl.selectRecordsAsync()).records;
		const existingRecord = records.find((rcd) => rcd.getCellValueAsString("@id") === recordId);

		if (!existingRecord) {
			return;
		}

		// if the field exists in the table merge the new data with the existing data
		const record = existingRecord.getCellValue(key);
		if (record && Array.isArray(record)) {
			value = [...record.map((r) => r.id), ...value];
		}

		// remove duplicates from value
		value = [...new Set(value)];

		if (value.length === 0) {
			return;
		}

		const fieldName = field.displayName || field.name;
		const formattedValue = value.map((val) => ({ id: val }));

		// Check if record is already in the list to update
		const id = updates
			.find((batch) => batch.tableName === tableName)
			?.updates.find((upd) => upd.id === existingRecord.id);
		if (id) {
			id.fields[fieldName] = formattedValue;
		} else {
			const updateBatch = updates.find((batch) => batch.tableName === tableName);
			if (updateBatch) {
				updateBatch.updates.push({
					id: existingRecord.id,
					fields: { [fieldName]: formattedValue },
				});
			} else {
				updates.push({
					tableName,
					updates: [{ id: existingRecord.id, fields: { [fieldName]: formattedValue } }],
				});
			}
		}
	}

	async function findLinkFieldsRecursively(tableName: string, field: FieldType, record: any) {
		if (field?.type === "object") {
			for (const prop of field.properties) {
				await findLinkFieldsRecursively(tableName, prop, record);
			}
		} else {
			if (field.type === "link") {
				await handleLinkFields(tableName, field.name, record[field.name], record["@id"]);
			}
		}
	}

	const updates: {
		tableName: string;
		updates: Array<{ id: string; fields: { [key: string]: unknown } }>;
	}[] = [];

	for (const data of tableData) {
		const tableName = data["@type"].split(":")[1];

		for (let [key, value] of Object.entries(data)) {
			const cid = new map[tableName as ModelType]();
			if (key !== "@type" && key !== "@context") {
				const field = cid.getFieldByName(key);
				if (field) {
					await findLinkFieldsRecursively(tableName, field, data);
				}
			}
		}
	}

	// Execute the updates in batches
	for (const updateBatch of updates) {
		const table = base.getTableByNameIfExists(updateBatch.tableName);
		await executeInBatches(updateBatch.updates, async (batch) => {
			await table.updateRecordsAsync(batch);
		});
	}
}

function removeDuplicatedLinks(jsonData: any) {
	for (const data of jsonData) {
		for (const [key, value] of Object.entries(data)) {
			if (Array.isArray(value)) {
				data[key] = [...new Set(value)];
			} else if (value && typeof value === "object") {
				removeDuplicatedLinksRecursively(value);
			}
		}
	}
	return jsonData;
}

function removeDuplicatedLinksRecursively(data: any) {
	for (const [key, value] of Object.entries(data)) {
		if (Array.isArray(value)) {
			data[key] = [...new Set(value)];
		} else if (typeof value === "object") {
			removeDuplicatedLinksRecursively(value);
		}
	}
}

function validateIfEmptyFile(tableData: TableInterface[]) {
	if (!Array.isArray(tableData) || tableData.length === 0) {
		return true;
	}
}

function doAllRecordsHaveId(tableData: TableInterface[]) {
	for (const data of tableData) {
		if (data["@id"] === undefined) {
			return false;
		}
	}
	return true;
}

function warnIfUnrecognizedFieldsWillBeIgnored(tableData: TableInterface[], intl: IntlShape) {
	const warnings = [];
	const classesSet = new Set();
	for (const data of tableData) {
		if (!data["@type"] || !Object.keys(map).includes(data["@type"].split(":")[1])) {
			continue;
		}
		const tableName = data["@type"].split(":")[1];
		if (!Object.keys(map).includes(tableName)) {
			continue;
		}
		if (classesSet.has(tableName)) {
			continue;
		}
		classesSet.add(tableName);
		for (const key in data) {
			if (!checkIfFieldIsRecognized(tableName, key) && key !== "@type" && key !== "@context") {
				warnings.push(
					`${intl.formatMessage(
						{
							id: "import.messages.warning.unrecognizedField",
							defaultMessage: `Table <b>{tableName}</b> has unrecognized field <b>{fieldName}</b>. This field will be ignored.`,
						},
						{ tableName, fieldName: key, b: (str) => `<b>${str}</b>` }
					)}`
				);
			}
		}
	}
	return warnings;
}

function checkIfFieldIsRecognized(tableName: string, fieldName: string) {
	const cid = new map[tableName as ModelType]();
	return cid
		.getAllFields()
		.reduce((acc, field) => {
			acc.push(field.name);
			if (field.name.includes(":")) {
				acc.push(field.name.split(":")[1]);
			}
			return acc;
		}, [])
		.includes(fieldName);
}

function findLastFieldValueForNestedFields(data: any, field: FieldType, record: any) {
	if (field?.type === "object") {
		for (const prop of field.properties) {
			let dataPropName;
			let recordData;
			if (field.name.includes(":") && Object.keys(data).includes(field.name.split(":")[1])) {
				dataPropName = field.name.split(":")[1];
			} else {
				dataPropName = field.name;
			}
			if (
				prop.name.includes(":") &&
				Object.keys(data[dataPropName]).includes(prop.name.split(":")[1])
			) {
				recordData = data[dataPropName][prop.name.split(":")[1]];
			} else {
				recordData = data[dataPropName][prop.name];
			}
			findLastFieldValueForNestedFields(recordData, prop, record);
		}
	} else if (data && typeof data === "object" && !Array.isArray(data)) {
		let recordData;
		if (field.name.includes(":") && Object.keys(data).includes(field.name.split(":")[1])) {
			recordData = data[field.name.split(":")[1]];
		} else {
			recordData = data[field.name];
		}
		record[field.displayName || field.name] = recordData;
	} else {
		record[field.displayName || field.name] = data ? data.toString() : data;
	}

	return record;
}

function transformObjectFieldIfWrongFormat(jsonData: TableInterface[]) {
	for (const data of jsonData) {
		for (const [key, value] of Object.entries(data)) {
			if (!data["@type"] || !Object.keys(map).includes(data["@type"].split(":")[1])) {
				continue;
			}

			if (key === "@type" || key === "@context" || key === "@id") {
				continue;
			}

			const cid = new map[data["@type"].split(":")[1] as ModelType]();
			const field = cid.getFieldByName(key);
			if (field?.type === "object") {
				const fieldValue = handleNestedObjectFieldType(jsonData, field, value);
				if (fieldValue) {
					data[key] = fieldValue;
				}
			}
		}
	}
	return jsonData;
}

function handleNestedObjectFieldType(data: TableInterface[], field: FieldType, value: any) {
	let fieldValue = null;
	if (field?.type === "object" && typeof value === "string") {
		fieldValue = data.find((d) => d["@id"] === value);
	} else if (field?.type === "object" && Array.isArray(value)) {
		fieldValue = data.find((d) => d["@id"] === value[0]);
	} else if (field?.type === "object" && typeof value === "object") {
		for (const prop of field.properties) {
			const newValue = handleNestedObjectFieldType(data, prop, value[prop.name]);
			if (newValue) {
				fieldValue = { [field.name]: newValue };
			}
		}
	}
	return fieldValue;
}

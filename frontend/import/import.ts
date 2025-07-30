/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-prototype-builtins */
import Base from "@airtable/blocks/dist/types/src/models/base";
import { IntlShape } from "react-intl";
import { TableInterface } from "../domain/interfaces/table.interface";
import { map, mapSFFModel, ModelType, SFFModelType } from "../domain/models";
import { FieldType } from "../domain/models/Base";
// import {
// 	formatSHACLValidationResults,
// 	validateWithSHACL as validateFn,
// } from "../domain/validation/shaclValidator";
import { validate } from "../domain/validation/validator";
import { checkPrimaryField } from "../helpers/checkPrimaryField";
import { createSFFModuleTables } from "../helpers/createSFFModuleTables";
import { createTables } from "../helpers/createTables";
import { convertIcAddressToPostalAddress, executeInBatches, parseJsonLd } from "../utils";

export async function importData(
	jsonData: any,
	base: Base,
	setDialogContent: (
		header: string,
		text: string,
		open: boolean,
		nextCallback?: () => void
	) => void,
	intl: IntlShape,
	setIsLoading: (loading: boolean) => void
) {
	// Check if the user has CREATOR permission
	if (!base.hasPermissionToCreateTable()) {
		setDialogContent(
			intl.formatMessage({
				id: "generics.error",
				defaultMessage: "Error",
			}),
			intl.formatMessage({
				id: "import.messages.error.wrongPermissionLevel",
				defaultMessage:
					"You don't have permission to create tables in this base, please contact the base owner to give you <b>CREATOR</b> permission.",
			}),
			true
		);
		return;
	}

	if (validateIfEmptyFile(jsonData)) {
		setDialogContent(
			intl.formatMessage({
				id: "generics.error",
				defaultMessage: "Error",
			}),
			intl.formatMessage({
				id: "import.messages.error.emptyOrNotArray",
				defaultMessage: "Table data is empty or not an array",
			}),
			true
		);
		return;
	}

	if (!doAllRecordsHaveId(jsonData)) {
		setDialogContent(
			intl.formatMessage({
				id: "generics.error",
				defaultMessage: "Error",
			}),
			intl.formatMessage({
				id: "import.messages.error.missingId",
				defaultMessage: "All records must have an <b>@id</b> property.",
			}),
			true
		);
		return;
	}

	const primaryFieldErrors = await checkPrimaryField(base, intl);
	if (primaryFieldErrors.length > 0) {
		setDialogContent(
			intl.formatMessage({
				id: "generics.error",
				defaultMessage: "Error",
			}),
			primaryFieldErrors.join("<hr/>"),
			true
		);
		return;
	}

	jsonData = await parseJsonLd(jsonData);

	// After parsing, convert all Address objects (by @type) in the array
	if (Array.isArray(jsonData)) {
		jsonData = jsonData.map((obj) => {
			if (
				obj &&
				typeof obj === "object" &&
				obj["@type"] &&
				((typeof obj["@type"] === "string" && obj["@type"].toLowerCase().includes("address")) ||
					(Array.isArray(obj["@type"]) &&
						obj["@type"].some((t: string) => t.toLowerCase().includes("address"))))
			) {
				return convertIcAddressToPostalAddress(obj);
			}
			return obj;
		});
	} else if (
		jsonData &&
		typeof jsonData === "object" &&
		jsonData["@type"] &&
		((typeof jsonData["@type"] === "string" &&
			jsonData["@type"].toLowerCase().includes("address")) ||
			(Array.isArray(jsonData["@type"]) &&
				jsonData["@type"].some((t: string) => t.toLowerCase().includes("address"))))
	) {
		jsonData = convertIcAddressToPostalAddress(jsonData);
	}

	jsonData = removeDuplicatedLinks(jsonData);

	let allErrors = "";
	let allWarnings = "";

	// Check if json data is a valid json array
	if (!Array.isArray(jsonData)) {
		setDialogContent(
			intl.formatMessage({
				id: "generics.error",
				defaultMessage: "Error",
			}),
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
	let { errors, warnings } = await validate(jsonData, "import", intl);

	warnings = [...warnings, ...warnIfUnrecognizedFieldsWillBeIgnored(jsonData, intl)];

	// // Perform SHACL validation (CIDS always, SFF if needed)
	// try {
	// 	setDialogContent(
	// 		intl.formatMessage({
	// 			id: "import.messages.validating.shacl",
	// 			defaultMessage: "Validating data against SHACL shapes...",
	// 		}),
	// 		intl.formatMessage({
	// 			id: "import.messages.validating.shacl.description",
	// 			defaultMessage: "Checking if the data conforms to the required shapes and constraints.",
	// 		}),
	// 		true
	// 	);

	// 	// Always validate with cids.shacl.ttl
	// 	const { loadSHACLData } = await import("../utils");
	// 	const cidsTtl = await loadSHACLData("cids");
	// 	const cidsResult = await validateFn(jsonData, cidsTtl, intl);

	// 	// Detect if SFF module properties are present
	// 	const hasSFF = (obj) => {
	// 		if (Array.isArray(obj)) return obj.some(hasSFF);
	// 		if (obj && typeof obj === "object") {
	// 			for (const key of Object.keys(obj)) {
	// 				if (key.startsWith("sff:")) return true;
	// 				if (typeof obj[key] === "object" && hasSFF(obj[key])) return true;
	// 			}
	// 			if (obj["@context"]) {
	// 				if (typeof obj["@context"] === "string" && obj["@context"].includes("sff")) return true;
	// 				if (
	// 					Array.isArray(obj["@context"]) &&
	// 					obj["@context"].some((c) => typeof c === "string" && c.includes("sff"))
	// 				)
	// 					return true;
	// 			}
	// 		}
	// 		return false;
	// 	};

	// 	let sffResult;
	// 	if (hasSFF(jsonData)) {
	// 		const sffTtl = await loadSHACLData("sff");
	// 		sffResult = await validateFn(jsonData, sffTtl, intl);
	// 	}

	// 	// Always process CIDS result
	// 	if (cidsResult && !cidsResult.conforms) {
	// 		const shaclWarnings = formatSHACLValidationResults(cidsResult, intl);
	// 		warnings.push(...shaclWarnings);
	// 	}
	// 	// If SFF result exists, process it too
	// 	if (sffResult && !sffResult.conforms) {
	// 		const shaclWarnings = formatSHACLValidationResults(sffResult, intl);
	// 		warnings.push(...shaclWarnings);
	// 	}
	// 	if (cidsResult && cidsResult.conforms && (!sffResult || sffResult.conforms)) {
	// 		// Show success message briefly
	// 		console.log("✅ SHACL validation passed");
	// 	}
	// } catch (shaclError: any) {
	// 	// If SHACL validation fails, add it as a warning rather than blocking import
	// 	console.warn("SHACL validation error:", shaclError.message);
	// 	const errorWarning = intl.formatMessage(
	// 		{
	// 			id: "validation.shacl.warning",
	// 			defaultMessage: "SHACL validation could not be performed: {error}",
	// 		},
	// 		{ error: shaclError.message }
	// 	);
	// 	warnings.push(String(errorWarning));
	// }

	allErrors = errors.join("<hr/>");
	allWarnings = warnings.join("<hr/>");

	if (allErrors.length > 0) {
		setDialogContent(
			intl.formatMessage({
				id: "generics.error",
				defaultMessage: "Error",
			}),
			allErrors,
			true
		);
		return;
	}

	if (allWarnings.length > 0) {
		setDialogContent(
			intl.formatMessage({
				id: "generics.warning",
				defaultMessage: "Warning",
			}),
			allWarnings,
			true,
			() => {
				setDialogContent(
					intl.formatMessage({
						id: "generics.warning",
						defaultMessage: "Warning",
					}),
					intl.formatMessage({
						id: "import.messages.warning.continue",
						defaultMessage: "<p>Do you want to import anyway?</p>",
					}),
					true,
					async () => {
						try {
							setIsLoading(true);
							await importFileData(base, jsonData, setDialogContent, intl);
						} finally {
							setIsLoading(false);
						}
					}
				);
			}
		);
	} else {
		await importFileData(base, jsonData, setDialogContent, intl);
	}
}

async function importFileData(base: Base, jsonData: any, setDialogContent: any, intl: IntlShape) {
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
	try {
		// Ignore types/classes that are not recognized
		const fullMap = { ...map, ...mapSFFModel };
		const filteredItems = Array.isArray(jsonData)
			? jsonData.filter((data) => Object.keys(fullMap).includes(data["@type"].split(":")[1]))
			: jsonData;
		await importByData(base, filteredItems, intl);
	} catch (error) {
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
		intl.formatMessage({
			id: "generics.success",
			defaultMessage: "Success",
		}),
		`${intl.formatMessage({
			id: "import.messages.success",
			defaultMessage: "Your data has been successfully imported.",
		})}`,
		true
	);
}

async function importByData(base: Base, jsonData: any, intl: IntlShape) {
	// Create Tables if they don't exist
	await createTables(intl);

	// Check if data has any class from SFF module
	for (const data of jsonData) {
		if (
			!data["@type"] ||
			(!Object.keys(map).includes(data["@type"].split(":")[1]) &&
				!Object.keys(mapSFFModel).includes(data["@type"].split(":")[1]))
		) {
			continue;
		} else if (Object.keys(mapSFFModel).includes(data["@type"].split(":")[1])) {
			await createSFFModuleTables(intl);
			break;
		}
	}

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
		Object.entries(data).forEach(async ([key, value]) => {
			if (key === "@type" || key === "@context" || !checkIfFieldIsRecognized(tableName, key)) {
				return;
			}

			let cid;
			if (Object.keys(map).includes(tableName)) {
				cid = new map[tableName as ModelType]();
			} else {
				cid = new mapSFFModel[tableName as SFFModelType]();
			}

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
					let newValue: any = value;
					if (newValue && (field.type === "select" || field.type === "multiselect")) {
						let options;
						if (field.getOptionsAsync) {
							options = await field.getOptionsAsync();
						} else {
							options = field.selectOptions;
						}
						if (
							field.type === "select" &&
							options.find((opt) => opt.id === (Array.isArray(newValue) ? newValue[0] : newValue))
						) {
							const optionField = options.find(
								(opt) => opt.id === (Array.isArray(newValue) ? newValue[0] : newValue)
							);
							if (optionField) {
								newValue = {
									name: optionField.name,
								};
							} else {
								newValue = null;
							}
						} else if (field.type === "multiselect") {
							newValue = (Array.isArray(newValue) ? newValue : [newValue]).map((val) => {
								const optionField = options.find((opt) => opt.id === val);
								if (optionField) {
									return {
										name: optionField.name,
									};
								}
								return null;
							});
							// Remove null values
							newValue = newValue.filter((val) => val);
							if (newValue.length === 0) {
								newValue = null;
							}
						} else {
							newValue = null;
						}
					}
					// Handle number type
					if (field.type === "number") {
						if (newValue !== null && newValue !== undefined && newValue !== "") {
							const parsed = Number(newValue);
							newValue = isNaN(parsed) ? null : parsed;
						} else {
							newValue = null;
						}
					}
					if (field.type === "boolean") {
						if (newValue && (newValue === true || (newValue as string).toLowerCase() === "true")) {
							newValue = true;
						} else {
							newValue = false;
						}
					}
					if (
						field.type !== "boolean" &&
						field.type !== "select" &&
						field.type !== "multiselect" &&
						field.type !== "number" &&
						newValue
					) {
						newValue = newValue ? newValue.toString() : null;
					}
					record[fieldName] = newValue;
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
		let cid;
		if (Object.keys(map).includes(tableName)) {
			cid = new map[tableName as ModelType]();
		} else {
			cid = new mapSFFModel[tableName as SFFModelType]();
		}

		let field: FieldType | null = null;
		try {
			field = cid.getFieldByName(key);
		} catch (_) {
			return;
		}

		if (!value) return; // Skip if the value is empty

		// @ts-ignore
		if (!Array.isArray(value)) value = [value];

		// remove duplicates from value
		value = [...new Set(value as string[])];

		// get ids from linked table
		const linkedTable = base.getTableByNameIfExists(field.link.table.className);
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
		const record = existingRecord.getCellValue(field.displayName || field.name);
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
			let cid;
			if (Object.keys(map).includes(tableName)) {
				cid = new map[tableName as ModelType]();
			} else {
				cid = new mapSFFModel[tableName as SFFModelType]();
			}

			if (key !== "@type" && key !== "@context" && checkIfFieldIsRecognized(tableName, key)) {
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
	return false;
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
		if (
			!data["@type"] ||
			(!Object.keys(map).includes(data["@type"].split(":")[1]) &&
				!Object.keys(mapSFFModel).includes(data["@type"].split(":")[1]))
		) {
			continue;
		}

		const tableName = data["@type"].split(":")[1];
		if (classesSet.has(tableName)) {
			continue;
		}

		for (const key in data) {
			if (key !== "@type" && key !== "@context" && !checkIfFieldIsRecognized(tableName, key)) {
				warnings.push(
					`${intl.formatMessage(
						{
							id: "import.messages.warning.unrecognizedField",
							defaultMessage: `Table <b>{tableName}</b> has unrecognized field <b>{fieldName}</b>. This field will be ignored.`,
						},
						{ tableName, fieldName: key, b: (str) => `<b>${str}</b>` }
					)}`
				);
				classesSet.add(tableName);
			}
		}
	}
	return warnings;
}

function checkIfFieldIsRecognized(tableName: string, fieldName: string) {
	let cid;
	if (Object.keys(map).includes(tableName)) {
		cid = new map[tableName as ModelType]();
	} else {
		cid = new mapSFFModel[tableName as SFFModelType]();
	}
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
			if (field.name.includes(":") && Object.keys(data).includes(field.name.split(":")[1])) {
				dataPropName = field.name.split(":")[1];
			} else {
				dataPropName = field.name;
			}
			const recordData = data[dataPropName];
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
		let value = data;
		if (value) {
			value = data.toString();
		}
		record[field.displayName || field.name] = value;
	}

	return record;
}

function transformObjectFieldIfWrongFormat(jsonData: TableInterface[]) {
	for (const data of jsonData) {
		for (const [key, value] of Object.entries(data)) {
			if (
				!data["@type"] ||
				(!Object.keys(map).includes(data["@type"].split(":")[1]) &&
					!Object.keys(mapSFFModel).includes(data["@type"].split(":")[1]))
			) {
				continue;
			}

			if (
				key === "@type" ||
				key === "@context" ||
				key === "@id" ||
				!checkIfFieldIsRecognized(data["@type"].split(":")[1], key)
			) {
				continue;
			}

			let cid;
			if (Object.keys(map).includes(data["@type"].split(":")[1])) {
				cid = new map[data["@type"].split(":")[1] as ModelType]();
			} else {
				cid = new mapSFFModel[data["@type"].split(":")[1] as SFFModelType]();
			}

			const field = cid.getFieldByName(key);
			if (field?.type === "object") {
				const fieldValue = handleNestedObjectFieldType(jsonData, field, value);
				if (fieldValue) {
					data[key] = fieldValue;
				}
			} else if (field?.type === "link" && typeof value === "object" && !Array.isArray(value)) {
				let id = value["@id"];
				if (!id) {
					id =
						data["@id"] +
						"/" +
						(value["@type"].includes(":") ? value["@type"].split(":")[1] : value["@type"]);
				}
				value["@id"] = id;
				jsonData.push(value);
				data[key] = id;
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

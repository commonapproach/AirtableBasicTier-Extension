/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-prototype-builtins */
import Base from "@airtable/blocks/dist/types/src/models/base";
import { IntlShape } from "react-intl";
import { getCodeListByTableName } from "../domain/fetchServer/getCodeLists";
import { TableInterface } from "../domain/interfaces/table.interface";
import { ignoredFields, map, mapSFFModel, ModelType, SFFModelType } from "../domain/models";
import { FieldType } from "../domain/models/Base";
import { validate } from "../domain/validation/validator";
import { checkPrimaryField } from "../helpers/checkPrimaryField";
import { createSFFModuleTables } from "../helpers/createSFFModuleTables";
import { createTables } from "../helpers/createTables";
import {
	convertForFunderIdToForOrganization,
	convertIcAddressToPostalAddress,
	convertIcHasAddressToHasAddress,
	convertNumericalValueToHasNumericalValue,
	convertOrganizationIDFields,
	convertUnknownUnitToDescription,
	executeInBatches,
	harmonizeCardinalityProperty,
	parseJsonLd,
} from "../utils";

function normalizeValue(val: any): string {
	if (val === null || val === undefined) return "";
	if (typeof val === "object" && val.name) return String(val.name).trim();
	if (typeof val === "object") return JSON.stringify(val);
	return String(val).trim();
}

// Helper: extract a primary standard type (cids:, sff:, or org:) from @type which may be string or array
function getPrimaryStandardType(typeVal: any): string | null {
	if (!typeVal) return null;
	const isTarget = (t: string) => t.startsWith("cids:") || t.startsWith("sff:") || t.startsWith("org:");
	if (typeof typeVal === "string") return isTarget(typeVal) ? typeVal : null;
	if (Array.isArray(typeVal)) {
		const found = typeVal.find((t) => typeof t === "string" && isTarget(t));
		return found || null;
	}
	return null;
}

// Helper: get the table name suffix from @type, preferring cids:/sff: namespace first
function getCidsTableSuffix(typeVal: any): string | null {
	const main = getPrimaryStandardType(typeVal);
	if (main) return main.split(":")[1];
	if (typeof typeVal === "string") {
		return typeVal.includes(":") ? typeVal.split(":")[1] : typeVal;
	}
	return null;
}

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

	// Convert old i72:numerical_value/numerical_value to i72:hasNumericalValue before any validation
	jsonData = convertNumericalValueToHasNumericalValue(jsonData);

	// Convert OrganizationID fields and normalize @type for backward compatibility
	jsonData = convertOrganizationIDFields(jsonData);

	// Convert unknown unit_of_measure to unitDescription for backward compatibility
	const unitConversionResult = await convertUnknownUnitToDescription(jsonData);
	jsonData = unitConversionResult.data;
	const convertedUnknownUnits = unitConversionResult.converted;

	// Convert ic:hasAddress to hasAddress for backward compatibility
	const originalData = JSON.stringify(jsonData);
	jsonData = convertIcHasAddressToHasAddress(jsonData);
	const convertedPropertyNames = JSON.stringify(jsonData) !== originalData;

	// Convert forFunderId to forOrganization for backward compatibility
	const originalDataFunding = JSON.stringify(jsonData);
	jsonData = convertForFunderIdToForOrganization(jsonData);
	const convertedFundingPropertyNames = JSON.stringify(jsonData) !== originalDataFunding;

	// Harmonize population cardinality property names (legacy describesPopulation vs ontology i72:cardinality_of)
	jsonData = harmonizeCardinalityProperty(jsonData);

	// After parsing, convert all Address objects (by @type) in the array
	let convertedAddress = false;
	function convertAndTrack(obj: any) {
		if (
			obj &&
			typeof obj === "object" &&
			obj["@type"] &&
			((typeof obj["@type"] === "string" && obj["@type"].toLowerCase().includes("address")) ||
				(Array.isArray(obj["@type"]) &&
					obj["@type"].some((t: string) => t.toLowerCase().includes("address"))))
		) {
			const original = JSON.stringify(obj); // Capture original state
			const converted = convertIcAddressToPostalAddress(obj);

			// Check if conversion happened by comparing original vs converted
			const conversionHappened = JSON.stringify(converted) !== original;
			if (conversionHappened) convertedAddress = true;

			return converted;
		}
		return obj;
	}
	if (Array.isArray(jsonData)) {
		jsonData = jsonData.map(convertAndTrack);
	} else if (
		jsonData &&
		typeof jsonData === "object" &&
		jsonData["@type"] &&
		((typeof jsonData["@type"] === "string" &&
			jsonData["@type"].toLowerCase().includes("address")) ||
			(Array.isArray(jsonData["@type"]) &&
				jsonData["@type"].some((t: string) => t.toLowerCase().includes("address"))))
	) {
		jsonData = convertAndTrack(jsonData);
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

	// Add address conversion warning if needed
	if (convertedAddress) {
		warnings.push(
			intl.formatMessage({
				id: "import.messages.warning.addressConverted",
				defaultMessage: "Some addresses were converted from the old format to the new format.",
			})
		);
	}

	// Add property name conversion warning if needed
	if (convertedPropertyNames || convertedFundingPropertyNames) {
		warnings.push(
			intl.formatMessage({
				id: "import.messages.warning.propertyNamesConverted",
				defaultMessage:
					"Some property names were converted from old format (ic:hasAddress to hasAddress).",
			})
		);
	}

	// Add unknown unit conversion warning if needed
	if (convertedUnknownUnits) {
		warnings.push(
			intl.formatMessage({
				id: "import.messages.warning.unknownUnitsConverted",
				defaultMessage:
					"Some unknown unit_of_measure values were copied to unitDescription field. Please review and select the correct unit from the dropdown.",
			})
		);
	}

	warnings = [...warnings, ...warnIfUnrecognizedFieldsWillBeIgnored(jsonData, intl)];

	const codeListWarnings = await warnIfCodeListItemsModified(jsonData, intl);
	warnings = [...warnings, ...codeListWarnings];

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
			? jsonData.filter((data) => {
					const suffix = getCidsTableSuffix(data["@type"]);
					return suffix ? Object.keys(fullMap).includes(suffix) : false;
			})
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
			(() => {
				const s = getCidsTableSuffix(data["@type"]);
				return !(s && (Object.keys(map).includes(s) || Object.keys(mapSFFModel).includes(s)));
			})()
		) {
			continue;
		} else if (Object.keys(mapSFFModel).includes(getCidsTableSuffix(data["@type"]) || "")) {
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
		const tableName = getCidsTableSuffix(data["@type"]) || "";
		// Skip items with no recognized CIDS table type
		if (
			!tableName ||
			(!Object.keys(map).includes(tableName) && !Object.keys(mapSFFModel).includes(tableName))
		) {
			continue;
		}

		let record: { [key: string]: unknown } = {};
		Object.entries(data).forEach(async ([key, value]) => {
			if (key.includes(":") && !key.startsWith("@")) {
				const originalKey = key;
				key = key.split(":")[1];
				if (!data[key]) {
					data[key] = data[originalKey];
				}
			}

			if (key === "@context" || !checkIfFieldIsRecognized(tableName, key)) {
				return;
			}

			let cid;
			if (Object.keys(map).includes(tableName)) {
				cid = new map[tableName as ModelType]();
			} else if (Object.keys(mapSFFModel).includes(tableName)) {
				cid = new mapSFFModel[tableName as SFFModelType]();
			} else {
				// Unknown class; skip
				return;
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
						if (Array.isArray(newValue)) {
							newValue = newValue.join(", ");
						} else {
							newValue = newValue ? newValue.toString() : null;
						}
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
		const tableName = getCidsTableSuffix(data["@type"]) || "";
		if (
			!tableName ||
			(!Object.keys(map).includes(tableName) && !Object.keys(mapSFFModel).includes(tableName))
		) {
			continue;
		}

		for (let [key, value] of Object.entries(data)) {
			let cid;
			if (Object.keys(map).includes(tableName)) {
				cid = new map[tableName as ModelType]();
			} else if (Object.keys(mapSFFModel).includes(tableName)) {
				cid = new mapSFFModel[tableName as SFFModelType]();
			} else {
				continue;
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

	// Auto-created fields that Airtable creates for reciprocal links
	const autoCreatedFields = [
		"hasIndicatorReport", // Auto-created by IndicatorReport→forOrganization
		"hasID", // Auto-created by OrganizationID→forOrganization
		"issuedOrganizationID", // Auto-created by OrganizationID→issuedBy
		"forOrganizationID", // Auto-created by CorporateRegistrar
	];

	for (const data of tableData) {
		if (
			!data["@type"] ||
			(() => {
				const s = getCidsTableSuffix(data["@type"]);
				return !(s && (Object.keys(map).includes(s) || Object.keys(mapSFFModel).includes(s)));
			})()
		) {
			continue;
		}

		const tableName = getCidsTableSuffix(data["@type"]) || "";
		if (classesSet.has(tableName)) {
			continue;
		}

		for (const key in data) {
			// Skip @type and @context
			if (key === "@type" || key === "@context") {
				continue;
			}

			// Skip auto-created fields silently (no warnings for these)
			if (autoCreatedFields.includes(key)) {
				continue;
			}

			// Skip fields in ignoredFields list (intentionally ignored)
			if (ignoredFields[tableName]?.includes(key)) {
				continue;
			}

			// Only warn for truly unrecognized fields
			if (!checkIfFieldIsRecognized(tableName, key)) {
				warnings.push(
					`${intl.formatMessage(
						{
							id: "import.messages.warning.unrecognizedField",
							defaultMessage: `Field <b>{fieldName}</b> in table <b>{tableName}</b> is inconsistent with the Basic Tier of the Common Impact Data Standard. This field will not be imported.`,
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

async function warnIfCodeListItemsModified(tableData: TableInterface[], intl: IntlShape) {
	const warnings = [];
	const predefinedCodeLists = [
		"Sector",
		"PopulationServed",
		"Locality",
		"ProvinceTerritory",
		"OrganizationType",
		"CorporateRegistrar",
	];

	for (const data of tableData) {
		const tableName = getCidsTableSuffix(data["@type"]) || "";

		// Only check predefined code list tables
		if (!predefinedCodeLists.includes(tableName)) {
			continue;
		}

		// Skip if no @id (validation will catch this elsewhere)
		if (!data["@id"]) {
			continue;
		}

		try {
			// Get the predefined code list for this table
			const codeList = await getCodeListByTableName(tableName);

			if (codeList && codeList.length > 0) {
				const existingItem = codeList.find((item) => item["@id"] === data["@id"]);

				if (existingItem) {
					// Check if imported data differs from predefined code list
					let hasChanges = false;

					for (const fieldName of Object.keys(existingItem)) {
						if (fieldName === "@id") continue; // Skip ID comparison

						const importedValue = normalizeValue(data[fieldName]);
						const codeListValue = normalizeValue(existingItem[fieldName]);

						if (importedValue !== codeListValue) {
							hasChanges = true;
							break;
						}
					}

					if (hasChanges) {
						warnings.push(
							intl.formatMessage(
								{
									id: "import.messages.warning.codeListModified",
									defaultMessage: `Record with @id <b>{id}</b> in table <b>{tableName}</b> differs from the predefined code list item. The imported version will be used, which may cause inconsistencies.`,
								},
								{ id: data["@id"], tableName: tableName, b: (str) => `<b>${str}</b>` }
							)
						);
					}
				}
			}
		} catch (error) {
			// If we can't fetch the code list, just skip this check
			console.warn(`Could not check code list for ${tableName}:`, error);
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
			// Also add displayName if different from name
			if (field.displayName && field.displayName !== field.name) {
				acc.push(field.displayName);
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
				(() => {
					const s = getCidsTableSuffix(data["@type"]);
					return !(s && (Object.keys(map).includes(s) || Object.keys(mapSFFModel).includes(s)));
				})()
			) {
				continue;
			}

			if (
				key === "@type" ||
				key === "@context" ||
				key === "@id" ||
				!checkIfFieldIsRecognized(getCidsTableSuffix(data["@type"]) || "", key)
			) {
				continue;
			}

			let cid;
			if (Object.keys(map).includes(getCidsTableSuffix(data["@type"]) || "")) {
				cid = new map[getCidsTableSuffix(data["@type"]) as string as ModelType]();
			} else {
				cid = new mapSFFModel[getCidsTableSuffix(data["@type"]) as string as SFFModelType]();
			}

			const field = cid.getFieldByName(key);
			if (field?.type === "object") {
				const fieldValue = handleNestedObjectFieldType(jsonData, field, value);
				if (fieldValue) {
					data[key] = fieldValue;
				}
			} else if (field?.type === "link" && typeof value === "object" && !Array.isArray(value)) {
				// Allow link fields provided as an object, e.g., {"@id": "..."}
				// Always normalize the record field to the string @id value
				let id = value["@id"] as string | undefined;
				if (!id) {
					// If there is no explicit @id, try to derive one only when a @type exists
					const typeSuffix =
						getCidsTableSuffix(value["@type"]) ||
						(typeof value["@type"] === "string" ? (value["@type"] as string) : "");
					if (typeSuffix) {
						id = (data["@id"] as string).replace(/\/$/, "") + "/" + typeSuffix;
						value["@id"] = id;
					}
				}
				if (id) {
					data[key] = id;
				} else {
					// If we still don't have an id, drop the value to avoid invalid data
					data[key] = undefined;
				}

				// Only add the nested object to the dataset when it has a @type (to avoid
				// introducing objects that fail validation due to missing @type), and avoid duplicates
				if (value && value["@type"] && id) {
					const alreadyExists = jsonData.some((d) => d && d["@id"] === id);
					if (!alreadyExists) {
						jsonData.push(value);
					}
				}
			} else if (field?.type === "link" && Array.isArray(value)) {
				// Handle arrays of objects for link fields, e.g., [{"@id": "..."}, {"@id": "..."}]
				const processedIds: string[] = [];

				for (const item of value) {
					if (typeof item === "object" && item !== null) {
						const obj = item as any;
						let id = obj["@id"] as string | undefined;
						if (!id) {
							// If there is no explicit @id, try to derive one only when a @type exists
							const typeSuffix =
								getCidsTableSuffix(obj["@type"]) ||
								(typeof obj["@type"] === "string" ? (obj["@type"] as string) : "");
							if (typeSuffix) {
								id = (data["@id"] as string).replace(/\/$/, "") + "/" + typeSuffix;
								obj["@id"] = id;
							}
						}

						if (id) {
							processedIds.push(id);

							// Only add the nested object to the dataset when it has a @type and avoid duplicates
							if (obj["@type"]) {
								const alreadyExists = jsonData.some((d) => d && d["@id"] === id);
								if (!alreadyExists) {
									jsonData.push(obj);
								}
							}
						}
					} else if (typeof item === "string") {
						// Already a string ID, keep it as is
						processedIds.push(item);
					}
				}

				// Replace the field value with the array of IDs
				data[key] = processedIds;
			} else if (
				(field?.type === "select" || field?.type === "multiselect") &&
				typeof value === "object" &&
				!Array.isArray(value)
			) {
				// Handle select/multiselect fields provided as an object, e.g., {"@id": "..."}
				// Extract the @id and use it as the select option value
				const id = value["@id"] as string | undefined;
				if (id) {
					data[key] = id;
				} else {
					// If no @id, drop the value to avoid invalid data
					data[key] = undefined;
				}
			} else if (
				(field?.type === "select" || field?.type === "multiselect") &&
				Array.isArray(value)
			) {
				// Handle arrays of objects for select/multiselect fields
				const processedIds: string[] = [];

				for (const item of value) {
					if (typeof item === "object" && item !== null) {
						const obj = item as any;
						const id = obj["@id"] as string | undefined;
						if (id) {
							processedIds.push(id);
						}
					} else if (typeof item === "string") {
						processedIds.push(item);
					}
				}

				data[key] = processedIds;
			}
			// No else clause - original behavior: don't normalize other fields
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

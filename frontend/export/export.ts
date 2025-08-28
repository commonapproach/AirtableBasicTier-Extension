import Base from "@airtable/blocks/dist/types/src/models/base";
import { Record } from "@airtable/blocks/models";
import moment from "moment-timezone";
import { IntlShape } from "react-intl";
import { CodeList, getCodeListByTableName } from "../domain/fetchServer/getCodeLists";
import {
	UNIT_DEFINITIONS,
	UNIT_IRI,
	getUnitDefinition,
} from "../domain/fetchServer/getUnitsOfMeasure";
import { LinkedCellInterface } from "../domain/interfaces/cell.interface";
import { contextUrl, ignoredFields, map, mapSFFModel, predefinedCodeLists } from "../domain/models";
import { FieldType } from "../domain/models/Base";
import { validate } from "../domain/validation/validator";
import { checkPrimaryField } from "../helpers/checkPrimaryField";
import { downloadJSONLD, getActualFieldType } from "../utils";

// Resolve the Airtable field name for a model field: prefer displayName; otherwise, strip prefix before ':'
function getAirtableFieldName(field: FieldType): string {
	if (field.displayName && field.displayName.length > 0) return field.displayName;
	const n = field.name || "";
	return n.includes(":") ? n.split(":")[1] : n;
}

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
				intl.formatMessage({
					id: "generics.error",
					defaultMessage: "Error",
				}),
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
			intl.formatMessage({
				id: "generics.error",
				defaultMessage: "Error",
			}),
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
			const airtableName = getAirtableFieldName(field);
			const airtableField = table.fields.find((f) => f.name === airtableName);
			if (airtableField) {
				const expectedType = getActualFieldType(field.type);
				if (airtableField.type !== expectedType) {
					setDialogContent(
						intl.formatMessage({
							id: "generics.error",
							defaultMessage: "Error",
						}),
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

			// Determine the correct @type namespace.
			// Previously everything (except Population) was exported as cids:ClassName which was incorrect for SFF module tables.
			// Customer request: SFF tables (those only in mapSFFModel) must use the sff: namespace.
			const isSFFTable = Object.prototype.hasOwnProperty.call(mapSFFModel, table.name);
			const baseType =
				table.name === "Population"
					? "i72:Population"
					: isSFFTable
					? `sff:${table.name}`
					: `cids:${table.name}`;
			let row: any = {
				"@context": contextUrl,
				"@type": baseType,
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
									defaultMessage: `Record in table <b>{tableName}</b> with @id: <b>{recordId}</b> is similar to the predefined code list item with @id: <b>{codeListItemId}</b>.<br/>Please review the code list item before exporting, or a custom code list item will be exported.`,
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

			// Helper state when exporting Indicators
			// for potential multi-typing e.g., i72:Cardinality (no direct use variable required)

			for (const field of cid.getTopLevelFields()) {
				const airtableName = getAirtableFieldName(field);
				if (field.type === "link") {
					const value: any = record.getCellValue(airtableName);
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
							// If this is the Indicator's cardinality_of link, add multi-typing i72:Cardinality
							if (field.name === "i72:cardinality_of") {
								const currentType = row["@type"];
								const types = Array.isArray(currentType) ? currentType : [currentType];
								if (!types.includes("i72:Cardinality")) {
									row["@type"] = [...types, "i72:Cardinality"];
								}
								row[field.name] = fieldValue.toString();
							} else {
								row[field.name] = fieldValue.toString();
							}
						} else {
							// No value
							row[field.name] = field?.defaultValue ?? "";
						}
					}
				} else if (field.type === "object") {
					const [newRow, newIsEmpty] = getObjectFieldsRecursively(record, field, row, isEmpty);
					row = { ...row, ...newRow };
					isEmpty = newIsEmpty;
				} else if (field.type === "select") {
					const fieldValue = record.getCellValue(airtableName) ?? "";
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
					const fieldValue = record.getCellValue(airtableName) ?? [];
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
					const fieldValue = record.getCellValueAsString(airtableName) ?? "";
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
					const fieldValue = record.getCellValueAsString(airtableName) ?? "";
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
					const fieldValue = record.getCellValue(airtableName) ?? false;
					row[field.name] = fieldValue ? true : false;
				} else {
					const fieldValue = record.getCellValue(airtableName) ?? field.defaultValue;
					if (fieldValue) {
						isEmpty = false;
					}
					let exportValue = fieldValue;
					if (Array.isArray(fieldValue) && field.representedType === "array") {
						exportValue = fieldValue;
					} else if (!Array.isArray(fieldValue) && field.representedType === "array") {
						exportValue = fieldValue ? [fieldValue] : field.defaultValue;
					} else if (field.type === "number") {
						// Export as number (integer/float), not string
						if (fieldValue !== null && fieldValue !== undefined && fieldValue !== "") {
							const parsed = Number(fieldValue);
							exportValue = isNaN(parsed) ? null : parsed;
						} else {
							exportValue = null;
						}
					} else {
						exportValue = fieldValue ? fieldValue.toString() : field.defaultValue;
					}
					row[field.name] = exportValue;
				}
			}
			// No automatic population or multi-typing logic beyond Indicator cardinality; Population exported only from Population table.

			if (!isEmpty) {
				// Remove empty string/null/empty array properties; exception: preserve empty Measure numerical value (i72:hasNumericalValue)
				const cleaned = Object.fromEntries(
					Object.entries(row).filter((entry) => {
						const v = entry[1];
						if (v === null || v === undefined) return false;
						if (
							typeof v === "string" &&
							v.trim() === "" &&
							entry[0] !== "i72:hasNumericalValue" // Keep as "" to distinguish missing vs zero/unknown
						)
							return false;
						if (Array.isArray(v) && v.length === 0) return false;
						return true;
					})
				);
				data.push(cleaned);
			}
		}
	}

	// Ensure each IndicatorReport value has a unit_of_measure; default to Indicator's or unspecified
	const indicatorUnitById: { [key: string]: string } = {};
	const usedUnitIris: Set<string> = new Set();
	for (const item of data) {
		if (
			Array.isArray(item?.["@type"])
				? item["@type"].includes("cids:Indicator")
				: item?.["@type"] === "cids:Indicator"
		) {
			if (item["@id"]) {
				const existing = item["i72:unit_of_measure"];
				const resolved =
					existing && typeof existing === "string" && existing.trim().length > 0
						? existing
						: UNIT_IRI.UNSPECIFIED;
				if (!existing) {
					item["i72:unit_of_measure"] = resolved;
				}
				indicatorUnitById[item["@id"]] = resolved;
				usedUnitIris.add(resolved);
			}
		}
	}
	for (const item of data) {
		if (
			Array.isArray(item?.["@type"])
				? item["@type"].includes("cids:IndicatorReport")
				: item?.["@type"] === "cids:IndicatorReport"
		) {
			const indicatorId = item["forIndicator"];
			const valueObj = item?.["i72:value"]; // Some exports may embed object; our exporter currently emits objects via getObjectFieldsRecursively
			if (valueObj && !valueObj["i72:unit_of_measure"]) {
				const fallback =
					(typeof indicatorId === "string" && indicatorUnitById[indicatorId]) ||
					UNIT_IRI.UNSPECIFIED;
				valueObj["i72:unit_of_measure"] = fallback;
				usedUnitIris.add(fallback);
			}
		}
	}

	// Inject unit definition objects for any used units, plus related cids units referenced by those definitions
	const queue: string[] = Array.from(usedUnitIris);
	const seen: Set<string> = new Set();
	while (queue.length > 0) {
		const iri = queue.shift() as string;
		if (seen.has(iri)) continue;
		seen.add(iri);
		const def = (await getUnitDefinition(iri)) || UNIT_DEFINITIONS[iri];
		if (def) {
			const already = data.some((d) => d && d["@id"] === iri);
			if (!already) data.push({ "@context": contextUrl, ...def });
			// Enqueue related cids unit IRIs referenced by this definition
			for (const val of Object.values(def)) {
				if (
					typeof val === "string" &&
					val.startsWith("https://ontology.commonapproach.org/cids#")
				) {
					queue.push(val);
				}
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
	]
		.filter(Boolean)
		.join("<hr/>");

	if (errors.length > 0) {
		setDialogContent(
			intl.formatMessage({
				id: "generics.error",
				defaultMessage: "Error",
			}),
			errors.map((item) => `<p>${item}</p>`).join(""),
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
				// Final deep clean before download (after user confirms warnings)
				const cleanedData = deepCleanExportObjects(data);
				setDialogContent(
					intl.formatMessage({
						id: "generics.warning",
						defaultMessage: "Warning",
					}),
					intl.formatMessage({
						id: "export.messages.warning.continue",
						defaultMessage: "<p>Do you want to export anyway?</p>",
					}),
					true,
					() => {
						downloadJSONLD(cleanedData, `${getFileName(orgName)}.json`);
						setDialogContent("", "", false);
					}
				);
			}
		);
		return;
	}
	const cleanedDataNoWarnings = deepCleanExportObjects(data);
	downloadJSONLD(cleanedDataNoWarnings, `${getFileName(orgName)}.json`);
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

// Recursively remove empty string, null, undefined, and empty arrays/objects from export objects.
// Preserve i72:hasNumericalValue when it's an empty string (intentional signal).
function deepCleanExportObjects(items: any[]): any[] {
	const shouldKeepEmptyStringKey = (key: string) => key === "i72:hasNumericalValue";
	function clean(value: any, parentKey?: string): any {
		if (Array.isArray(value)) {
			const cleanedArr = value
				.map((v) => clean(v))
				.filter(
					(v) =>
						!(
							v === null ||
							v === undefined ||
							(Array.isArray(v) && v.length === 0) ||
							(typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)
						)
				);
			return cleanedArr;
		}
		if (value && typeof value === "object") {
			const entries = Object.entries(value)
				.map(([k, v]) => [k, clean(v, k)] as [string, any])
				.filter(([k, v]) => {
					if (v === null || v === undefined) return false;
					if (typeof v === "string") {
						if (v.trim() === "" && !shouldKeepEmptyStringKey(k)) return false;
					}
					if (Array.isArray(v) && v.length === 0) return false;
					if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)
						return false;
					return true;
				});
			return Object.fromEntries(entries);
		}
		if (
			typeof value === "string" &&
			value.trim() === "" &&
			!shouldKeepEmptyStringKey(parentKey || "")
		) {
			return undefined;
		}
		return value;
	}
	return items.map((item) => clean(item)).filter((x) => x && Object.keys(x).length > 0);
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
							id: Object.keys(map).includes(table.name)
								? "export.messages.warning.fieldWillNotBeExported"
								: "export.messages.warning.notExported",
							defaultMessage:
								"Field <b>{fieldName}</b> on table <b>{tableName}</b> will not be exported",
						},
						{ fieldName: field, tableName: table.name, b: (str: string) => `<b>${str}</b>` }
					) as string
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
		const airtableName = getAirtableFieldName(field);
		const value = record.getCellValue(airtableName) ?? field.defaultValue;

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

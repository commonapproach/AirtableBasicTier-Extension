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
import { downloadJSONLD, formatMessageToString, getActualFieldType } from "../utils";
import { ExportScope, isRecordInScope, resolveExportScope } from "./resolveexportscope";

function getAirtableFieldName(field: FieldType): string {
	if (field.displayName && field.displayName.length > 0) return field.displayName;
	return field.name;
}

function getExportFieldName(field: FieldType): string {
	return field.name;
}

// ─── Shared serialisation logic ───────────────────────────────────────────────
// Builds the export data array and runs validation. Used by both the review
// screen (preview warnings) and exportData (download). Returns raw warning
// strings without HTML so the caller can format them as needed.

export async function buildExportData(
	base: Base,
	intl: IntlShape,
	selectedOrgIds?: string[],
	selectedYears?: number[]
): Promise<{
	data: any[];
	errors: string[];
	warnings: string[];
}> {
	const tables = base.tables;
	let data: any[] = [];
	let fullMap = map;

	const tableNamesOnBase = tables.map((t) => t.name);
	const sffModuleTables = Object.keys(mapSFFModel);
	if (sffModuleTables.some((t) => tableNamesOnBase.includes(t))) {
		fullMap = { ...map, ...mapSFFModel };
	}

	const scope: ExportScope | null =
		selectedOrgIds?.length && selectedYears?.length
			? await resolveExportScope(base, selectedOrgIds, selectedYears)
			: null;

	const changeOnDefaultCodeListsWarning: string[] = [];

	for (const table of tables) {
		if (!Object.keys(fullMap).includes(table.name)) continue;

		const records = (await table.selectRecordsAsync()).records;
		let codeList: CodeList[] | null = null;
		if (predefinedCodeLists.includes(table.name)) {
			codeList = await getCodeListByTableName(table.name);
		}

		const cid = new fullMap[table.name]();
		for (const record of records) {
			if (record.isDeleted || !table.fields.some((field) => record.getCellValue(field.name))) {
				continue;
			}
			const recordAtId = record.getCellValueAsString("@id");
			if (!isRecordInScope(scope, table.name, recordAtId)) continue;

			const isSFFTable = Object.prototype.hasOwnProperty.call(mapSFFModel, table.name);
			const baseType =
				table.name === "Population"
					? "i72:Population"
					: table.name === "Person"
						? "cids:Person"
						: table.name === "OrganizationID"
							? "org:OrganizationID"
							: table.name === "Characteristic"
                    			? "cids:Characteristic" 
								: isSFFTable
									? `sff:${table.name}`
									: `cids:${table.name}`;

			let row: any = { "@context": contextUrl, "@type": baseType };
			let isEmpty = true;

			if (codeList && record.getCellValueAsString("@id")) {
				const existingItem = codeList.find(
					(item) => item["@id"] === record.getCellValueAsString("@id")
				);
				if (existingItem) {
					let hasChanges = false;
					for (const fieldName of Object.keys(existingItem)) {
						if (fieldName === "@type") continue;
						const field = table.getFieldByNameIfExists(fieldName);
						if (!field) continue;
						const recordValue = record.getCellValue(field.id);
						const existingValue = existingItem[fieldName];
						const normalizeValue = (val: any): string => {
							if (val === null || val === undefined) return "";
							if (typeof val === "object" && val.name) return String(val.name).trim();
							if (typeof val === "object") return JSON.stringify(val);
							return String(val).trim();
						};
						if (normalizeValue(recordValue) !== normalizeValue(existingValue)) {
							hasChanges = true;
							break;
						}
					}
					if (hasChanges) {
						changeOnDefaultCodeListsWarning.push(
							formatMessageToString(
								intl,
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

			if (codeList) {
				const existingItem = codeList.find((item) =>
					Object.keys(item).every((key) => {
						if (key === "@id" || key === "@type") return true;
						if (!table.getFieldByNameIfExists(key)) return true;
						return record.getCellValueAsString(key) === item[key].toString();
					})
				);
				if (existingItem) {
					let hasChanges = false;
					for (const fieldName of Object.keys(existingItem)) {
						if (fieldName === "@type") continue;
						const field = table.getFieldByNameIfExists(fieldName);
						if (!field) continue;
						const recordValue = record.getCellValue(field.id);
						const existingValue = existingItem[fieldName];
						const normalizeValue = (val: any): string => {
							if (val === null || val === undefined) return "";
							if (typeof val === "object" && val.name) return String(val.name).trim();
							if (typeof val === "object") return JSON.stringify(val);
							return String(val).trim();
						};
						if (normalizeValue(recordValue) !== normalizeValue(existingValue)) {
							hasChanges = true;
							break;
						}
					}
					if (hasChanges) {
						changeOnDefaultCodeListsWarning.push(
							formatMessageToString(
								intl,
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

			for (const field of cid.getTopLevelFields()) {
				const airtableName = getAirtableFieldName(field);
				const exportFieldName = getExportFieldName(field);
				if (field.type === "link") {
					const value: any = record.getCellValue(airtableName);
					if (field.representedType === "array") {
						const fieldValue = value?.map((item: LinkedCellInterface) => item.name) ?? [];
						if (fieldValue && fieldValue.length > 0) isEmpty = false;
						row[exportFieldName] = fieldValue;
					} else if (field.representedType === "string") {
						let fieldValue;
						if (Array.isArray(value) && value.length > 0 && value[0]?.name) {
							fieldValue = value[0].name;
						} else if (typeof value === "string") {
							fieldValue = value;
						} else {
							fieldValue = field?.defaultValue;
						}
						if (fieldValue) {
							isEmpty = false;
							if (field.name === "i72:cardinality_of") {
								const currentType = row["@type"];
								const types = Array.isArray(currentType) ? currentType : [currentType];
								if (!types.includes("i72:Cardinality")) {
									row["@type"] = [...types, "i72:Cardinality"];
								}
							}
							row[exportFieldName] = fieldValue.toString();
						} else {
							row[exportFieldName] = field?.defaultValue ?? "";
						}
					}
				} else if (field.type === "object") {
					const [newRow, newIsEmpty] = getObjectFieldsRecursively(record, field, row, isEmpty);
					row = { ...row, ...newRow };
					isEmpty = newIsEmpty;
				} else if (field.type === "select") {
					const fieldValue = record.getCellValue(airtableName) ?? "";
					if (fieldValue && fieldValue["name"]) isEmpty = false;
					let optionField;
					if (field.getOptionsAsync) {
						const options = await field.getOptionsAsync();
						optionField = options.find((opt) => opt.name === fieldValue["name"]);
					} else {
						optionField = field.selectOptions.find((opt) => opt.name === fieldValue["name"]);
					}
					if (optionField) {
						row[exportFieldName] =
							field.representedType === "array" ? [optionField.id] : optionField.id;
					} else {
						row[exportFieldName] =
							field.representedType === "array" ? [fieldValue["name"]] : fieldValue["name"];
					}
				} else if (field.type === "multiselect") {
					const fieldValue = record.getCellValue(airtableName) ?? [];
					if (fieldValue && (fieldValue as { name: string }[]).length > 0) isEmpty = false;
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
					row[exportFieldName] =
						field.representedType === "array"
							? [...recognizedOptionIds, ...unrecognizedOptionNames]
							: [...recognizedOptionIds, ...unrecognizedOptionNames].join(", ");
				} else if (field.type === "datetime") {
					const fieldValue = record.getCellValueAsString(airtableName) ?? "";
					if (fieldValue && typeof fieldValue === "string") {
						isEmpty = false;
						const localTimezone = moment.tz.guess();
						const parsed = moment(fieldValue).tz(localTimezone);
						if (field.name === "startedAtTime") parsed.seconds(1);
						else if (field.name === "endedAtTime") parsed.seconds(59);
						row[exportFieldName] = parsed.format("YYYY-MM-DDTHH:mm:ssZ");
					} else {
						row[exportFieldName] = "";
					}
				} else if (field.type === "date") {
					const fieldValue = record.getCellValueAsString(airtableName) ?? "";
					if (fieldValue && typeof fieldValue === "string") {
						isEmpty = false;
						const localTimezone = moment.tz.guess();
						row[exportFieldName] = moment(fieldValue).tz(localTimezone).format("YYYY-MM-DD");
					} else {
						row[exportFieldName] = "";
					}
				} else if (field.type === "boolean") {
					row[exportFieldName] = record.getCellValue(airtableName) ? true : false;
				} else {
					const fieldValue = record.getCellValue(airtableName) ?? field.defaultValue;
					if (fieldValue) isEmpty = false;
					let exportValue = fieldValue;
					if (Array.isArray(fieldValue) && field.representedType === "array") {
						exportValue = fieldValue;
					} else if (!Array.isArray(fieldValue) && field.representedType === "array") {
						if (
							field.name === "@type" &&
							typeof fieldValue === "string" &&
							fieldValue.includes(",")
						) {
							exportValue = fieldValue.split(",").map((s) => s.trim());
						} else {
							exportValue = fieldValue ? [fieldValue] : field.defaultValue;
						}
					} else if (field.representedType === "number") {
						const num = parseFloat(fieldValue as string);
						exportValue = isNaN(num) ? field.defaultValue : num;
					} else {
						exportValue = fieldValue ? fieldValue.toString() : field.defaultValue;
					}
					row[exportFieldName] = exportValue;
				}
			}

			if (!isEmpty) {
				const cleaned = Object.fromEntries(
					Object.entries(row).filter((entry) => {
						const v = entry[1];
						if (v === null || v === undefined) return false;
						if (typeof v === "string" && v.trim() === "" && entry[0] !== "hasNumericalValue")
							return false;
						if (Array.isArray(v) && v.length === 0) return false;
						return true;
					})
				);
				data.push(cleaned);
			}
		}
	}

	// Unit injection
	const indicatorUnitById: { [key: string]: string } = {};
	const usedUnitIris: Set<string> = new Set();
	for (const item of data) {
		if (
			Array.isArray(item?.["@type"])
				? item["@type"].includes("cids:Indicator")
				: item?.["@type"] === "cids:Indicator"
		) {
			if (item["@id"]) {
				const existing = item["unit_of_measure"];
				const resolved =
					existing && typeof existing === "string" && existing.trim().length > 0
						? existing
						: UNIT_IRI.UNSPECIFIED;
				if (!existing) item["unit_of_measure"] = resolved;
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
			const valueObj = item?.["value"];
			if (valueObj && !valueObj["unit_of_measure"]) {
				const fallback =
					(typeof indicatorId === "string" && indicatorUnitById[indicatorId]) ||
					UNIT_IRI.UNSPECIFIED;
				valueObj["unit_of_measure"] = fallback;
				usedUnitIris.add(fallback);
			}
		}
	}
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
	const emptyTableWarning = await checkForEmptyTables(base, intl, scope);
	const allWarnings = [
		...checkForNotExportedFields(base, intl),
		...warnings,
		...emptyTableWarning,
		...changeOnDefaultCodeListsWarning,
	].filter(Boolean);

	return { data, errors, warnings: allWarnings };
}

// ─── Main export function ─────────────────────────────────────────────────────

export async function exportData(
	base: Base,
	setDialogContent: (header: string, text: string, open: boolean, nextCallback?: () => void) => void,
	orgName: string,
	intl: IntlShape,
	selectedOrgIds?: string[],
	selectedYears?: number[],
	skipWarningDialog = false
): Promise<void> {
	const tables = base.tables;

	// Table existence check
	let fullMap = map;
	const tableNamesOnBase = tables.map((t) => t.name);
	if (Object.keys(mapSFFModel).some((t) => tableNamesOnBase.includes(t))) {
		fullMap = { ...map, ...mapSFFModel };
	}
	const tableNames = tables.map((t) => t.name);
	for (const [key] of Object.entries(map)) {
		if (!tableNames.includes(key)) {
			setDialogContent(
				intl.formatMessage({ id: "generics.error", defaultMessage: "Error" }),
				formatMessageToString(
					intl,
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

	// Field type validation
	for (const table of tables) {
		if (!Object.keys(fullMap).includes(table.name)) continue;
		const cid = new fullMap[table.name]();
		for (const field of cid.getAllFields()) {
			const airtableName = getAirtableFieldName(field);
			const airtableField = table.fields.find((f) => f.name === airtableName);
			if (airtableField) {
				const expectedType = getActualFieldType(field.type);
				const isLinkField = expectedType === "multipleRecordLinks";
				const isAllowedLinkType =
					isLinkField &&
					(airtableField.type === "formula" || airtableField.type === "multipleLookupValues");
				if (airtableField.type !== expectedType && !isAllowedLinkType) {
					setDialogContent(
						intl.formatMessage({ id: "generics.error", defaultMessage: "Error" }),
						formatMessageToString(
							intl,
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

	const primaryFieldErrors = await checkPrimaryField(base, intl);
	if (primaryFieldErrors.length > 0) {
		setDialogContent(
			intl.formatMessage({ id: "generics.error", defaultMessage: "Error" }),
			primaryFieldErrors.join("<hr/>"),
			true
		);
		return;
	}

	// Build data + run validator
	const { data, errors, warnings } = await buildExportData(
		base,
		intl,
		selectedOrgIds,
		selectedYears
	);

	const allWarnings = warnings.join("<hr/>");

	if (errors.length > 0) {
		setDialogContent(
			intl.formatMessage({ id: "generics.error", defaultMessage: "Error" }),
			errors.map((item) => `<p>${item}</p>`).join(""),
			true
		);
		return;
	}

	// If warnings were already shown in the wizard, skip the interstitial dialog
	if (allWarnings.length > 0 && !skipWarningDialog) {
		setDialogContent(
			intl.formatMessage({ id: "generics.warning", defaultMessage: "Warning" }),
			allWarnings,
			true,
			() => {
				const cleanedData = deepCleanExportObjects(data);
				setDialogContent(
					intl.formatMessage({ id: "generics.warning", defaultMessage: "Warning" }),
					intl.formatMessage({
						id: "export.messages.warning.continue",
						defaultMessage: "<p>Do you want to export anyway?</p>",
					}),
					true,
					() => {
						downloadJSONLD(cleanedData, `${orgName}.json`);
						setDialogContent("", "", false);
					}
				);
			}
		);
		return;
	}

	downloadJSONLD(deepCleanExportObjects(data), `${orgName}.json`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deepCleanExportObjects(items: any[]): any[] {
	const shouldKeepEmptyStringKey = (key: string) => key === "hasNumericalValue";
	function clean(value: any, parentKey?: string): any {
		if (Array.isArray(value)) {
			return value
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
		}
		if (value && typeof value === "object") {
			const entries = Object.entries(value)
				.map(([k, v]) => [k, clean(v, k)] as [string, any])
				.filter(([k, v]) => {
					if (v === null || v === undefined) return false;
					if (typeof v === "string" && v.trim() === "" && !shouldKeepEmptyStringKey(k))
						return false;
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
	const warnings: string[] = [];
	const fullMap = { ...map, ...mapSFFModel };
	for (const table of base.tables) {
		if (!Object.keys(fullMap).includes(table.name)) continue;
		const cid = new fullMap[table.name]();
		const internalFields = cid.getAllFields().map((item) => item.displayName || item.name);
		const externalFields = table.fields.map((item) => item.name);
		for (const field of externalFields) {
			if (Object.keys(fullMap).includes(field) || ignoredFields[table.name]?.includes(field))
				continue;
			if (!internalFields.includes(field)) {
				warnings.push(
					formatMessageToString(
						intl,
						{
							id: Object.keys(map).includes(table.name)
								? "export.messages.warning.fieldWillNotBeExported"
								: "export.messages.warning.notExported",
							defaultMessage:
								"Field <b>{fieldName}</b> on table <b>{tableName}</b> will not be exported",
						},
						{ fieldName: field, tableName: table.name, b: (str: string) => `<b>${str}</b>` }
					)
				);
			}
		}
	}
	return warnings;
}

async function checkForEmptyTables(base: Base, intl: IntlShape, scope: ExportScope | null) {
	if (scope) return [];
	const warnings: string[] = [];
	const fullMap = { ...map, ...mapSFFModel };
	for (const table of base.tables) {
		if (!Object.keys(fullMap).includes(table.name)) continue;
		const records = await table.selectRecordsAsync();
		if (records.records.length === 0) {
			warnings.push(
				intl.formatMessage(
					{
						id: "export.messages.warning.emptyTable",
						defaultMessage: `Table <b>{tableName}</b> is empty`,
					},
					{ tableName: table.name, b: (str) => `<b>${str}</b>` }
				)
			);
		}
	}
	return warnings;
}

function getObjectFieldsRecursively(record: Record, field: FieldType, row: any, isEmpty: boolean) {
	if (field.type !== "object") {
		const airtableName = getAirtableFieldName(field);
		const exportFieldName = getExportFieldName(field);
		const value = record.getCellValue(airtableName) ?? field.defaultValue;

		if (field.type === "link") {
			if (field.representedType === "array") {
				const fieldValue =
					value?.map((item: LinkedCellInterface) => item.name) ?? field?.defaultValue;
				if (fieldValue && fieldValue.length > 0) isEmpty = false;
				row[exportFieldName] = fieldValue;
			} else if (field.representedType === "string") {
				const fieldValue = value ? value[0]?.name : field?.defaultValue;
				if (fieldValue) isEmpty = false;
				row[exportFieldName] = fieldValue.toString();
			}
		} else if (field.type === "datetime") {
			if (value && typeof value === "string") {
				isEmpty = false;
				const localTimezone = moment.tz.guess();
				row[exportFieldName] = moment(value).tz(localTimezone).format("YYYY-MM-DDTHH:mm:ssZ");
			} else {
				row[exportFieldName] = "";
			}
		} else if (field.type === "date") {
			if (value && typeof value === "string") {
				isEmpty = false;
				const localTimezone = moment.tz.guess();
				row[exportFieldName] = moment(value).tz(localTimezone).format("YYYY-MM-DD");
			} else {
				row[exportFieldName] = "";
			}
		} else if (field.type === "boolean") {
			row[exportFieldName] = value ? true : false;
		} else {
			if (value) isEmpty = false;
			let exportValue = value;
			if (Array.isArray(value) && field.representedType === "array") {
				exportValue = value;
			} else if (!Array.isArray(value) && field.representedType === "array") {
				exportValue = value ? [value] : field.defaultValue;
			} else {
				exportValue = value ? value.toString() : field.defaultValue;
			}
			row[exportFieldName] = exportValue;
		}
		return [row, isEmpty];
	}

	if (field.type === "object") {
		row[field.name] = { "@type": field.objectType };
		for (const property of field.properties) {
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
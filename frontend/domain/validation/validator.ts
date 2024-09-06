import { IntlShape } from "react-intl";
import { TableInterface } from "../interfaces/table.interface";
import { map, ModelType } from "../models";

type Operation = "import" | "export";

const validatorErrors = new Set<string>();
const validatorWarnings = new Set<string>();

export function validate(
	tableData: TableInterface[],
	operation: Operation = "export",
	intl: IntlShape
): {
	errors: string[];
	warnings: string[];
} {
	validatorWarnings.clear();
	validatorErrors.clear();

	validateIfEmptyFile(tableData, intl);

	validateIfIdIsValidUrl(tableData, operation, intl);

	// eslint-disable-next-line no-param-reassign
	tableData = removeEmptyRows(tableData);

	tableData.forEach((item) => {
		validateTypeProp(item, intl);
	});

	validateRecords(tableData, operation, intl);

	return {
		errors: Array.from(validatorErrors),
		warnings: Array.from(validatorWarnings),
	};
}

function validateRecords(tableData: TableInterface[], operation: Operation, intl: IntlShape) {
	// Records to keep track of unique values
	const uniqueRecords: Record<string, Set<any>> = {};

	validateLinkedFields(tableData, operation, intl);

	for (const data of tableData) {
		if (validateTypeProp(data, intl)) return;
		const tableName = data["@type"].split(":")[1];
		const id = data["@id"];
		const cid = new map[tableName as ModelType](); // Initialize the schema for the table

		// Initialize a record for this table if not already present
		if (!uniqueRecords[tableName]) {
			uniqueRecords[tableName] = new Set();
		}

		//check if required fields are present
		for (const field of cid.getAllFields()) {
			if (
				field.required &&
				!Object.keys(data)
					.map((d) => (d.indexOf(":") !== -1 ? d.split(":")[1] : d))
					.includes(field.name.indexOf(":") !== -1 ? field.name.split(":")[1] : field.name)
			) {
				if (operation === "import" && field.name !== "@id") {
					validatorWarnings.add(
						intl.formatMessage(
							{
								id: "validation.messages.missingRequiredField",
								defaultMessage:
									"Required field <b>{fieldName}</b> is missing on table <b>{tableName}</b>",
							},
							{
								fieldName: field.displayName || field.name,
								tableName,
								b: (str) => `<b>${str}</b>`,
							}
						)
					);
				} else {
					validatorErrors.add(
						intl.formatMessage(
							{
								id: "validation.messages.missingRequiredField",
								defaultMessage:
									"Required field <b>{fieldName}</b> is missing on table <b>{tableName}</b>",
							},
							{
								fieldName: field.displayName || field.name,
								tableName,
								b: (str) => `<b>${str}</b>`,
							}
						)
					);
				}
			}
		}

		for (const field of cid.getAllFields()) {
			if (field.semiRequired) {
				if (
					!Object.keys(data)
						.map((d) => (d.indexOf(":") !== -1 ? d.split(":")[1] : d))
						.includes(field.name.indexOf(":") !== -1 ? field.name.split(":")[1] : field.name)
				) {
					validatorWarnings.add(
						intl.formatMessage(
							{
								id: "validation.messages.missingRequiredField",
								defaultMessage:
									"Required field <b>{fieldName}</b> is missing on table <b>{tableName}</b>",
							},
							{
								fieldName: field.displayName || field.name,
								tableName,
								b: (str) => `<b>${str}</b>`,
							}
						)
					);
				}
				// @ts-ignore
				if (data[field.name]?.length === 0) {
					validatorWarnings.add(
						intl.formatMessage(
							{
								id: "validation.messages.emptyField",
								defaultMessage: `Field <b>{fieldName}</b> is empty on table <b>{tableName}</b>`,
							},
							{
								fieldName: field.displayName || field.name,
								tableName,
								b: (str) => `<b>${str}</b>`,
							}
						)
					);
				}
			}
		}

		// check if notNull fields are not null
		for (const field of cid.getAllFields()) {
			if (
				field.notNull &&
				operation === "export" &&
				((!data[field.name] && !data[field.name.split(":")[1]]) ||
					isFieldValueNullOrEmpty(data[field.name] || data[field.name.split(":")[1]]))
			) {
				const msg = intl
					.formatMessage(
						{
							id: "validation.messages.nullOrEmptyField",
							defaultMessage: `Field <b>{fieldName}</b> is null or empty on table <b>{tableName}</b>`,
						},
						{
							fieldName: field.displayName || field.name,
							tableName,
							b: (str) => `<b>${str}</b>`,
						}
					)
					.toString();
				validatorErrors.add(msg);
			}
		}

		for (let [fieldName, fieldValue] of Object.entries(data)) {
			if (fieldName === "@context" || fieldName === "@type") continue;
			const tableFields = cid.getAllFields().map((field) => field.name);
			const fieldDisplayName = cid.getFieldByName(fieldName)?.displayName || fieldName;

			for (const field of tableFields) {
				if (field.indexOf(":") !== -1) {
					const splitField = field.split(":");
					if (splitField[1] === fieldName) {
						fieldName = field;
						break;
					}
				}
			}

			let fieldProps: any = null;
			try {
				fieldProps = cid.getFieldByName(fieldName);
			} catch (_) {
				continue;
			}

			if (!fieldProps) {
				continue;
			}

			if (Array.isArray(fieldValue)) {
				// check if fieldValue has duplicate values
				const uniqueValues = new Set(fieldValue);
				if (uniqueValues.size !== fieldValue.length) {
					validatorWarnings.add(
						intl.formatMessage(
							{
								id: "validation.messages.duplicateFieldValues",
								defaultMessage: `Duplicate values in field <b>{fieldName}</b> on table <b>{tableName}</b}`,
							},
							{
								fieldName: fieldDisplayName,
								tableName,
								b: (str) => `<b>${str}</b>`,
							}
						)
					);
				}
			}

			if (fieldProps.type !== "object") {
				// Validate unique fields
				if (fieldProps?.unique) {
					if (!validateUnique(tableName, fieldName, fieldValue, uniqueRecords, id, intl)) {
						const msg = intl
							.formatMessage(
								{
									id: "validation.messages.duplicateUniqueFieldValue",
									defaultMessage: `Duplicate value for unique field <b>{fieldName}</b>: <b>{fieldValue}</b> in table <b>{tableName}</b}`,
								},
								{
									fieldName: fieldDisplayName,
									fieldValue,
									tableName,
									b: (str) => `<b>${str}</b>`,
								}
							)
							.toString();
						if (fieldName !== "@id") {
							validatorWarnings.add(msg);
						} else {
							validatorErrors.add(msg);
						}
					}
				}

				if (fieldProps?.notNull) {
					if (fieldValue === "" || !fieldValue) {
						validatorWarnings.add(
							intl.formatMessage(
								{
									id: "validation.messages.warning.nullOrEmptyField",
									defaultMessage:
										"Field <b>{fieldName}</b> on table <b>{tableName}</b> is null or empty.",
								},
								{
									fieldName: fieldDisplayName,
									tableName,
									b: (str) => `<b>${str}</b>`,
								}
							)
						);
					}
				}

				if (fieldProps?.required) {
					if (fieldValue === "" || !fieldValue) {
						validatorWarnings.add(
							intl.formatMessage(
								{
									id: "validation.messages.warning.missingRequiredField",
									defaultMessage:
										"Field <b>{fieldName}</b> on table <b>{tableName}</b> is required.",
								},
								{
									fieldName: fieldDisplayName,
									tableName,
									b: (str) => `<b>${str}</b>`,
								}
							)
						);
					}
				}

				if (fieldProps?.type === "select") {
					if (fieldProps.selectOptions && !fieldProps.selectOptions.includes(fieldValue)) {
						validatorWarnings.add(
							intl.formatMessage(
								{
									id: "validation.messages.warning.invalidSelectField",
									defaultMessage:
										"Field <b>{fieldName}</b> on table <b>{tableName}</b> has an invalid value.",
								},
								{
									fieldName: fieldDisplayName,
									tableName,
									b: (str) => `<b>${str}</b>`,
								}
							)
						);
					}
				}
			}
		}
	}
}

function validateUnique(
	tableName: string,
	fieldName: string,
	fieldValue: any,
	uniqueRecords: Record<string, Set<any>>,
	id: string,
	intl: IntlShape
): boolean {
	// Unique key for this field in the format "tableName.fieldName"
	if (!id) return false;
	let urlObject;

	try {
		urlObject = new URL(id);
	} catch (error) {
		validatorErrors.add(
			intl.formatMessage(
				{
					id: "validation.messages.invalidIdFormat",
					defaultMessage: `Invalid URL format: <b>{id}</b> for <b>@id</b> on table <b>{tableName}</b>`,
				},
				{
					id,
					tableName,
					b: (str) => `<b>${str}</b>`,
				}
			)
		);
		return false;
	}

	const baseUrl = `${urlObject.protocol}//${urlObject.hostname}`;

	const uniqueKey = `${tableName}.${fieldName}.${baseUrl}`;

	// Initialize a record for this field if not already present
	if (!uniqueRecords[uniqueKey]) {
		// eslint-disable-next-line no-param-reassign
		uniqueRecords[uniqueKey] = new Set();
	}

	// Check if the value already exists
	if (uniqueRecords[uniqueKey].has(fieldValue)) {
		// Value is not unique
		return false;
	} else {
		// Record this value as encountered and return true
		uniqueRecords[uniqueKey].add(fieldValue);
		return true;
	}
}

function validateTypeProp(data: any, intl: IntlShape): boolean {
	if (!("@type" in data)) {
		validatorErrors.add(
			intl.formatMessage({
				id: "validation.messages.missingTypeProperty",
				defaultMessage: "<b>@type</b> must be present in the data",
			})
		);
		return true;
	}
	if (data["@type"].length === 0) {
		validatorErrors.add(
			intl.formatMessage({
				id: "validation.messages.emptyTypeProperty",
				defaultMessage: "<b>@type</b> cannot be empty",
			})
		);
		return true;
	}
	try {
		if (data["@type"]?.split(":")[1].length === 0) {
			validatorErrors.add(
				intl.formatMessage({
					id: "validation.messages.invalidTypeProperty",
					defaultMessage: "<b>@type</b> must follow the format <b>cids:tableName</b>",
				})
			);
			return true;
		}
	} catch (error) {
		validatorErrors.add(
			intl.formatMessage({
				id: "validation.messages.invalidTypeProperty",
				defaultMessage: "<b>@type</b> must follow the format <b>cids:tableName</b>",
			})
		);
		return true;
	}
	const tableName = (data["@type"] as string)?.split(":")[1];
	if (!map[tableName as ModelType]) {
		validatorWarnings.add(
			intl.formatMessage(
				{
					id: "validation.messages.unrecognizedTypeProperty",
					defaultMessage:
						"Table <b>{tableName}</b> is not recognized in the basic tier and will be ignored.",
				},
				{
					tableName,
					b: (str) => `<b>${str}</b>`,
				}
			)
		);
		return true;
	}
	return false;
}

function validateLinkedFields(tableData: TableInterface[], operation: Operation, intl: IntlShape) {
	for (const data of tableData) {
		if (validateTypeProp(data, intl)) return;
		const tableName = data["@type"].split(":")[1];
		const cid = new map[tableName as ModelType](); // Initialize the schema for the table
		// for each field that has type link, check if all linked ids exists
		const fields = cid.getAllFields();
		const linkedFields = fields.filter((field) => field.type === "link");
		linkedFields.forEach((field) => {
			const fieldName = field.name;
			if (!data[fieldName]) {
				data[fieldName] = [];
			}

			let isString = false;
			if (!Array.isArray(data[fieldName])) {
				if (typeof data[fieldName] === "string") {
					isString = true;
				}
				data[fieldName] =
					typeof data[fieldName] === "string" && data[fieldName].length > 0
						? [...data[fieldName].split(", ")]
						: [];
			}

			if (data[fieldName].length === 0) {
				const msg = intl
					.formatMessage(
						{
							id: "validation.messages.missingLinkedField",
							defaultMessage: "{tableName} <b>{name}</b> has no {fieldName}",
						},
						{
							tableName,
							name: data["org:hasLegalName"] || data["hasLegalName"] || data["hasName"],
							fieldName: fieldName.substring(3),
							b: (str) => `<b>${str}</b>`,
						}
					)
					.toString();
				if (field.required && operation === "export") {
					validatorErrors.add(msg);
				} else if (field.required || field.semiRequired) {
					validatorWarnings.add(msg);
				}
			}

			if (isString && data[fieldName].length > 1) {
				if (operation === "import") {
					validatorWarnings.add(
						intl.formatMessage(
							{
								id: "validation.messages.multipleValuesWarning",
								defaultMessage:
									"Multiple values found in field <b>{fieldName}</b> at id {dataId} on table <b>{tableName}</b>. Only the first value {firstValue} will be considered",
							},
							{
								fieldName,
								dataId: data["@id"],
								tableName,
								firstValue: data[fieldName][0],
								b: (str) => `<b>${str}</b>`,
							}
						)
					);
				} else {
					validatorErrors.add(
						intl.formatMessage(
							{
								id: "validation.messages.multipleValues",
								defaultMessage:
									"Multiple values found in field <b>{fieldName}</b> at id {dataId} on table <b>{tableName}</b>.",
							},
							{
								fieldName,
								dataId: data["@id"],
								tableName,
								b: (str) => `<b>${str}</b>`,
							}
						)
					);
				}
				data[fieldName] = [data[fieldName][0]];
			}

			const linkedTable = field.link.table.className;
			const linkedIds: string[] = [];

			for (const linkedData of tableData) {
				if (validateTypeProp(linkedData, intl)) return;
				const linkedTableName = linkedData["@type"].split(":")[1];
				if (linkedTableName === linkedTable) {
					linkedIds.push(linkedData["@id"]);
				}
			}

			data[fieldName].forEach((item) => {
				if (!linkedIds.includes(item)) {
					validatorWarnings.add(
						intl.formatMessage(
							{
								id: "validation.messages.linkedFieldNotFound",
								defaultMessage:
									"{tableName} <b>{name}</b> linked on {fieldName} to item <b>{item}</b> that does not exist in the {linkedTable} table",
							},
							{
								tableName,
								name: data["org:hasLegalName"] || data["hasLegalName"] || data["hasName"],
								fieldName,
								item,
								linkedTable,
								b: (str) => `<b>${str}</b>`,
							}
						)
					);
				}
			});

			if (isString && operation === "export") {
				data[fieldName] = data[fieldName][0];
			}
		});
	}
}

function removeEmptyRows(tableData: TableInterface[]) {
	return tableData.filter((item) => item["@id"].length > 0);
}

function validateIfIdIsValidUrl(
	tableData: TableInterface[],
	operation: Operation,
	intl: IntlShape
) {
	tableData.map((item) => {
		let tableName;
		try {
			tableName = item["@type"].split(":")[1];
		} catch (error) {
			validatorErrors.add(
				intl.formatMessage({
					id: "validation.messages.missingTypeProperty",
					defaultMessage: "<b>@type</b> must be present in the data",
				})
			);
		}

		const id = item["@id"];
		try {
			new URL(item["@id"]);
		} catch (error) {
			if (operation === "import") {
				validatorWarnings.add(
					intl.formatMessage(
						{
							id: "validation.messages.invalidIdFormat",
							defaultMessage: `Invalid URL format: <b>{id}</b> for <b>@id</b> on table <b>{tableName}</b>`,
						},
						{
							id,
							tableName,
							b: (str) => `<b>${str}</b>`,
						}
					)
				);
				return;
			}
			validatorErrors.add(
				intl.formatMessage(
					{
						id: "validation.messages.invalidIdFormat",
						defaultMessage: `Invalid URL format: <b>{id}</b> for <b>@id</b> on table <b>{tableName}</b>`,
					},
					{
						id,
						tableName,
						b: (str) => `<b>${str}</b>`,
					}
				)
			);
			return;
		}
	});
}

function validateIfEmptyFile(tableData: TableInterface[], intl: IntlShape) {
	if (!Array.isArray(tableData) || tableData.length === 0) {
		validatorErrors.add(
			intl.formatMessage({
				id: "validation.messages.dataIsEmptyOrNotArray",
				defaultMessage: "Table data is empty or not an array",
			})
		);
	}
}

function isFieldValueNullOrEmpty(value: any) {
	if (typeof value === "string") {
		return value.trim().length === 0;
	}
	if (Array.isArray(value)) {
		return value.length === 0;
	}
	if (typeof value === "object") {
		return Object.keys(value).length === 0;
	}
	return value === null || value === undefined;
}

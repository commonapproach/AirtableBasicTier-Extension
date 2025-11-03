import { Base, FieldType, Table } from "@airtable/blocks/models";
import {
	CodeList,
	getAllCorporateRegistrars,
	getAllEquityDeservingGroups,
	getAllLocalities,
	getAllOrganizationType,
	getAllPopulationServed,
	getAllProvinceTerritory,
	getAllSectors,
} from "../domain/fetchServer/getCodeLists";

export const populateCodeList = async (base: Base, tableName: string) => {
	let data: CodeList[] = [];
	switch (tableName) {
		case "Sector":
			data = await getAllSectors();
			await populateTables(base, tableName, data);
			break;
		case "PopulationServed":
			data = await getAllPopulationServed();
			await populateTables(base, tableName, data);
			break;
		case "ProvinceTerritory":
			data = await getAllProvinceTerritory();
			await updateSelectFieldOptionsOnOrganizationProfile(base, "provinceTerritoryServed", data);
			break;
		case "OrganizationType":
			data = await getAllOrganizationType();
			await updateSelectFieldOptionsOnOrganizationProfile(base, "organizationType", data);
			break;
		case "Locality":
			data = await getAllLocalities();
			await updateSelectFieldOptionsOnOrganizationProfile(base, "localityServed", data);
			break;
		// ✅ ADD THESE TWO CASES:
		case "CorporateRegistrar":
			data = await getAllCorporateRegistrars();
			await populateTables(base, tableName, data);
			break;
		case "EquityDeservingGroup":
			data = await getAllEquityDeservingGroups();
			await populateTables(base, tableName, data);
			break;
		default:
			throw new Error(`Table ${tableName} not found`);
	}
};

const populateTables = async (base: Base, tableName: string, data: CodeList[]) => {
	const table = base.getTableByName(tableName);

	if (!table) {
		throw new Error(`Table ${tableName} not found`);
	}

	// Check if the record already exists
	const records = await table.selectRecordsAsync();

	// if a record with @id already exists, update it else create a new record, we do it by batches of 50
	const recordsToUpdate = records.records
		.filter((record) => data.some((d) => d["@id"] === record.getCellValueAsString("@id")))
		.map((record) => {
			const dataToUpdate = data.find((d) => d["@id"] === record.getCellValueAsString("@id"));
			return {
				id: record.id,
				fields: { ...dataToUpdate },
			};
		});

	const recordsToCreate = data.filter(
		(d) => !records.records.some((record) => d["@id"] === record.getCellValueAsString("@id"))
	);

	await updateRecords(table, recordsToUpdate);

	await createRecords(table, recordsToCreate);
};

const updateRecords = async (table: Table, data: { id: string; fields: any }[]) => {
	if (data.length === 0) {
		return;
	}

	await table.updateRecordsAsync(
		data.map((record) => {
			const recordData = {};
			for (const key in record.fields) {
				const field = table.getFieldByNameIfExists(key);
				if (field) {
					recordData[field.id] = record.fields[key];
				}
			}
			return { id: record.id, fields: recordData };
		})
	);
	return;
};

const createRecords = async (table: Table, data: any) => {
	if (data.length === 0) {
		return;
	}

	await table.createRecordsAsync(
		data.map((record) => {
			const recordData = {};
			for (const key in record) {
				const field = table.getFieldByNameIfExists(key);
				if (field) {
					recordData[field.id] = record[key];
				}
			}
			return { fields: recordData };
		})
	);
	return;
};

const updateSelectFieldOptionsOnOrganizationProfile = async (
	base: Base,
	filedName: string,
	data: CodeList[]
) => {
	const table = base.getTableByName("OrganizationProfile");

	if (!table) {
		throw new Error(`Table OrganizationProfile not found`);
	}

	const selectField = table.getFieldByNameIfExists(filedName);

	if (!selectField) {
		throw new Error(`Field ${filedName} not found in table OrganizationProfile`);
	}

	const options: any = selectField.options.choices as FieldType.SINGLE_SELECT;

	const newOptions = data.map((d) => ({ name: d.hasName }));

	await selectField.updateOptionsAsync({
		choices: [...options, ...newOptions.filter((o) => !options.some((op) => op.name === o.name))],
	});
};
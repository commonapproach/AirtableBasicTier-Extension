import { Base, Table } from "@airtable/blocks/models";
import { getAllSectors } from "../domain/codeLists/getSectorsCodeLists";

export const populateCodeList = async (base: Base, tableName: string) => {
	let data = [];
	if (tableName === "Sector") {
		data = await getAllSectors();
	} else {
		// eslint-disable-next-line no-undef
		data = require(`../domain/codeLists/${tableName}.json`);
	}
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

import { Base } from "@airtable/blocks/models";
import { fetchAndParseSeliGLISFI, SeliGLISFIData } from "../domain/fetchServer/getSELIGLISFI";

export async function populateSeliGLISFI(base: Base) {
	const { themes, outcomes, indicators, organization }: SeliGLISFIData =
		await fetchAndParseSeliGLISFI();

	// Helper to get model fields and link info
	function getTableFieldMap(table) {
		const fieldMap = {};
		const linkFields = {};
		const fields = table.fields;
		for (const f of fields) {
			fieldMap[f.name] = f;
			if (f.type === "multipleRecordLinks" || f.type === "singleRecordLink") {
				linkFields[f.name] = f;
			}
		}
		return { fieldMap, linkFields };
	}

	// First pass: upsert all records with only non-link fields
	async function upsertRecords(table, dataArr, idField = "@id") {
		const { fieldMap, linkFields } = getTableFieldMap(table);
		const records = await table.selectRecordsAsync();
		const toUpdate = records.records.filter((r) =>
			dataArr.some((d) => r.getCellValueAsString(idField) === (d.id || d["@id"]))
		);
		const toCreate = dataArr.filter(
			(d) =>
				!records.records.some((r) => r.getCellValueAsString(idField) === (d.id || d["@id"]))
		);

		const isLinkField = (fname) => fname in linkFields;

		if (toUpdate.length) {
			await table.updateRecordsAsync(
				toUpdate.map((r) => {
					const d = dataArr.find(
						(d) => r.getCellValueAsString(idField) === (d.id || d["@id"])
					);
					const fields = {};
					for (const fname in fieldMap) {
						if (fname === idField) fields[fname] = d.id || d["@id"];
						else if (!isLinkField(fname) && d[fname] !== undefined) fields[fname] = d[fname];
					}
					return { id: r.id, fields };
				})
			);
		}
		if (toCreate.length) {
			await table.createRecordsAsync(
				toCreate.map((d) => {
					const fields = {};
					for (const fname in fieldMap) {
						if (fname === idField) fields[fname] = d.id || d["@id"];
						else if (!isLinkField(fname) && d[fname] !== undefined) fields[fname] = d[fname];
					}
					return { fields };
				})
			);
		}
	}

	const organizationTable = base.getTableByNameIfExists("Organization");
	if (!organizationTable) throw new Error("Table Organization not found");
	if (organization) {
		await upsertRecords(organizationTable, [organization]);
	}

	const themeTable = base.getTableByNameIfExists("Theme");
	if (!themeTable) throw new Error("Table Theme not found");
	await upsertRecords(themeTable, themes);

	const outcomeTable = base.getTableByNameIfExists("Outcome");
	if (!outcomeTable) throw new Error("Table Outcome not found");
	await upsertRecords(outcomeTable, outcomes);

	const indicatorTable = base.getTableByNameIfExists("Indicator");
	if (!indicatorTable) throw new Error("Table Indicator not found");
	await upsertRecords(indicatorTable, indicators);

	// Second pass: update linked fields using Airtable record IDs
	const themeIdMap = {};
	(await themeTable.selectRecordsAsync()).records.forEach((r) => {
		themeIdMap[r.getCellValueAsString("@id")] = r.id;
	});
	const indicatorIdMap = {};
	(await indicatorTable.selectRecordsAsync()).records.forEach((r) => {
		indicatorIdMap[r.getCellValueAsString("@id")] = r.id;
	});
	const outcomeIdMap = {};
	(await outcomeTable.selectRecordsAsync()).records.forEach((r) => {
		outcomeIdMap[r.getCellValueAsString("@id")] = r.id;
	});
	const organizationIdMap = {};
	(await organizationTable.selectRecordsAsync()).records.forEach((r) => {
		organizationIdMap[r.getCellValueAsString("@id")] = r.id;
	});

	const allIdMaps = {
		Theme: themeIdMap,
		Outcome: outcomeIdMap,
		Indicator: indicatorIdMap,
		Organization: organizationIdMap,
	};

	// Helper to resolve and write link fields for a given table
	async function updateLinkFields(table, dataArr, idMap, allIdMaps) {
		const { linkFields } = getTableFieldMap(table);
		for (const d of dataArr) {
			const recId = idMap[d.id || d["@id"]];
			if (!recId) continue;
			const fields = {};
			for (const fname in linkFields) {
				if (d[fname]) {
					const linkField = linkFields[fname];
					// Try to get linked table name from field options first
					let linkTableName = linkField.options?.linkedTableName;
					if (!linkTableName) {
						// Infer from field name: forOrganization -> Organization, forTheme -> Theme, etc.
						const guess = fname.replace(/^for|has/, "");
						linkTableName = guess.charAt(0).toUpperCase() + guess.slice(1);
					}
					// Case-insensitive fallback lookup
					if (!allIdMaps[linkTableName]) {
						const foundKey = Object.keys(allIdMaps).find(
							(k) => k.toLowerCase() === linkTableName.toLowerCase()
						);
						if (foundKey) linkTableName = foundKey;
					}
					const finalTargetIdMap = allIdMaps[linkTableName];
					if (!finalTargetIdMap) {
						console.warn(
							`No id map for linked table: ${linkTableName} (field: ${fname})`
						);
						continue;
					}
					if (Array.isArray(d[fname])) {
						fields[fname] = d[fname]
							.map((val) => finalTargetIdMap[val])
							.filter(Boolean)
							.map((id) => ({ id }));
					} else {
						const idVal = finalTargetIdMap[d[fname]];
						if (idVal) fields[fname] = [{ id: idVal }];
					}
				}
			}
			if (Object.keys(fields).length > 0) {
				await table.updateRecordAsync(recId, fields);
			}
		}
	}

	await updateLinkFields(outcomeTable, outcomes, outcomeIdMap, allIdMaps);
	await updateLinkFields(indicatorTable, indicators, indicatorIdMap, allIdMaps);
	await updateLinkFields(themeTable, themes, themeIdMap, allIdMaps);
}
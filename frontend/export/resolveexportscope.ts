import Base from "@airtable/blocks/dist/types/src/models/base";

export interface ExportScope {
	/** @ids of IndicatorReports to include */
	indicatorReportIds: Set<string>;
	/** @ids of Indicators to include */
	indicatorIds: Set<string>;
	/** @ids of Outcomes to include */
	outcomeIds: Set<string>;
	/** @ids of Organisations to include */
	organizationIds: Set<string>;
	/** @ids of Themes to include */
	themeIds: Set<string>;
	/** @ids of all other in-scope records keyed by table name */
	otherIds: Map<string, Set<string>>;
}

/** Returns null when the caller should fall through to full-base export. */
export async function resolveExportScope(
	base: Base,
	selectedOrgIds: string[],
	selectedYears: number[]
): Promise<ExportScope | null> {
	if (!selectedOrgIds?.length || !selectedYears?.length) return null;

	const orgIdSet = new Set(selectedOrgIds);
	const yearSet = new Set(selectedYears);

	// ── Fetch core tables ─────────────────────────────────────────────────────
	const orgTable        = base.getTableByNameIfExists("Organization");
	const outcomeTable    = base.getTableByNameIfExists("Outcome");
	const indicatorTable  = base.getTableByNameIfExists("Indicator");
	const irTable         = base.getTableByNameIfExists("IndicatorReport");
	const addressTable    = base.getTableByNameIfExists("Address");
	const populationTable = base.getTableByNameIfExists("Population");

	if (!orgTable || !outcomeTable || !indicatorTable || !irTable) {
		return null;
	}

	const [orgRecords, outcomeRecords, indicatorRecords, irRecords] = await Promise.all([
		orgTable.selectRecordsAsync(),
		outcomeTable.selectRecordsAsync(),
		indicatorTable.selectRecordsAsync(),
		irTable.selectRecordsAsync(),
	]);

	// ── Lookup: Airtable record ID → org @id ─────────────────────────────────
	const orgAirtableIdToAtId = new Map<string, string>();
	for (const r of orgRecords.records) {
		const atId = r.getCellValueAsString("@id");
		if (atId) orgAirtableIdToAtId.set(r.id, atId);
	}

	// ── Step 1: Surviving IndicatorReports ────────────────────────────────────
	// Keep if: forOrganization is a selected org AND endedAtTime year is in selectedYears
	const survivingIRIds = new Set<string>();
	const indicatorAtIdsWithSurvivingIR = new Set<string>();

	for (const ir of irRecords.records) {
		const irAtId = ir.getCellValueAsString("@id");
		if (!irAtId) continue;

		// Check org
		const linkedOrgs = ir.getCellValue("forOrganization") as { id: string }[] | null;
		if (!linkedOrgs?.length) continue;
		const orgAtId = orgAirtableIdToAtId.get(linkedOrgs[0].id);
		if (!orgAtId || !orgIdSet.has(orgAtId)) continue;

		// Check year via endedAtTime
		let year: number | null = null;
		const endedRaw = ir.getCellValue("endedAtTime") as string | null;
		if (endedRaw) {
			const d = new Date(endedRaw);
			if (!isNaN(d.getFullYear())) year = d.getFullYear();
		}
		if (year === null || !yearSet.has(year)) continue;

		survivingIRIds.add(irAtId);

		// Track which Indicators have surviving IRs
		const linkedIndicators = ir.getCellValue("forIndicator") as { id: string; name: string }[] | null;
		if (linkedIndicators?.length) {
			for (const lnk of linkedIndicators) {
				if (lnk.name) indicatorAtIdsWithSurvivingIR.add(lnk.name);
			}
		}
	}

	// ── Step 2: Surviving Indicators ──────────────────────────────────────────
	// Keep if: forOrganization is selected AND has ≥1 surviving IR
	const survivingIndicatorIds = new Set<string>();
	const indicatorAtIdToOutcomeAtIds = new Map<string, string[]>();

	for (const ind of indicatorRecords.records) {
		const indAtId = ind.getCellValueAsString("@id");
		if (!indAtId) continue;

		const linkedOrgs = ind.getCellValue("forOrganization") as { id: string }[] | null;
		if (!linkedOrgs?.length) continue;
		const orgAtId = orgAirtableIdToAtId.get(linkedOrgs[0].id);
		if (!orgAtId || !orgIdSet.has(orgAtId)) continue;

		if (!indicatorAtIdsWithSurvivingIR.has(indAtId)) continue;

		survivingIndicatorIds.add(indAtId);

		const linkedOutcomes = ind.getCellValue("forOutcome") as { id: string; name: string }[] | null;
		if (linkedOutcomes?.length) {
			indicatorAtIdToOutcomeAtIds.set(
				indAtId,
				linkedOutcomes.map((o) => o.name).filter(Boolean)
			);
		}
	}

	// ── Step 3: Surviving Outcomes ────────────────────────────────────────────
	// Keep if: forOrganization is selected AND has ≥1 surviving Indicator
	const outcomesWithSurvivingIndicator = new Set<string>();
	for (const [, outcomeAtIds] of indicatorAtIdToOutcomeAtIds) {
		for (const oId of outcomeAtIds) outcomesWithSurvivingIndicator.add(oId);
	}

	const survivingOutcomeIds = new Set<string>();
	for (const out of outcomeRecords.records) {
		const outAtId = out.getCellValueAsString("@id");
		if (!outAtId) continue;

		const linkedOrgs = out.getCellValue("forOrganization") as { id: string }[] | null;
		if (!linkedOrgs?.length) continue;
		const orgAtId = orgAirtableIdToAtId.get(linkedOrgs[0].id);
		if (!orgAtId || !orgIdSet.has(orgAtId)) continue;

		if (!outcomesWithSurvivingIndicator.has(outAtId)) continue;
		survivingOutcomeIds.add(outAtId);
	}

	// ── Step 4: Surviving Themes ──────────────────────────────────────────────
	// Keep if referenced by any surviving Outcome or Indicator
	const survivingThemeIds = new Set<string>();

	for (const out of outcomeRecords.records) {
		const outAtId = out.getCellValueAsString("@id");
		if (!survivingOutcomeIds.has(outAtId)) continue;
		const linkedThemes = out.getCellValue("forTheme") as { id: string; name: string }[] | null;
		if (linkedThemes?.length) {
			for (const t of linkedThemes) if (t.name) survivingThemeIds.add(t.name);
		}
	}
	for (const ind of indicatorRecords.records) {
		const indAtId = ind.getCellValueAsString("@id");
		if (!survivingIndicatorIds.has(indAtId)) continue;
		const linkedThemes = ind.getCellValue("forTheme") as { id: string; name: string }[] | null;
		if (linkedThemes?.length) {
			for (const t of linkedThemes) if (t.name) survivingThemeIds.add(t.name);
		}
	}

	// ── Step 5: Other tables ──────────────────────────────────────────────────
	const otherIds = new Map<string, Set<string>>();

	// Address — direct forOrganization
	if (addressTable) {
		const records = await addressTable.selectRecordsAsync();
		const ids = new Set<string>();
		for (const r of records.records) {
			const atId = r.getCellValueAsString("@id");
			if (!atId) continue;
			const linkedOrgs = r.getCellValue("forOrganization") as { id: string }[] | null;
			if (!linkedOrgs?.length) continue;
			const orgAtId = orgAirtableIdToAtId.get(linkedOrgs[0].id);
			if (orgAtId && orgIdSet.has(orgAtId)) ids.add(atId);
		}
		otherIds.set("Address", ids);
	}

	// Population — transitive via forIndicator
	if (populationTable) {
		const records = await populationTable.selectRecordsAsync();
		const ids = new Set<string>();
		for (const r of records.records) {
			const atId = r.getCellValueAsString("@id");
			if (!atId) continue;
			const linkedIndicators = r.getCellValue("forIndicator") as { id: string; name: string }[] | null;
			if (!linkedIndicators?.length) continue;
			const indAtId = linkedIndicators[0]?.name;
			if (indAtId && survivingIndicatorIds.has(indAtId)) ids.add(atId);
		}
		otherIds.set("Population", ids);
	}

	// SFF tables with direct forOrganization — excludes FundingStatus (links via forOrganizationProfile)
	for (const tableName of ["OrganizationID", "OrganizationProfile", "ReportInfo"]) {
		const tbl = base.getTableByNameIfExists(tableName);
		if (!tbl) continue;
		const records = await tbl.selectRecordsAsync();
		const ids = new Set<string>();
		for (const r of records.records) {
			const atId = r.getCellValueAsString("@id");
			if (!atId) continue;
			const linkedOrgs = r.getCellValue("forOrganization") as { id: string }[] | null;
			if (!linkedOrgs?.length) continue;
			const orgAtId = orgAirtableIdToAtId.get(linkedOrgs[0].id);
			if (orgAtId && orgIdSet.has(orgAtId)) ids.add(atId);
		}
		otherIds.set(tableName, ids);
	}

	// Person, Characteristic, and FundingStatus — transitive via OrganizationProfile
	const orgProfileIds = otherIds.get("OrganizationProfile") ?? new Set<string>();
	for (const tableName of ["Person", "Characteristic", "FundingStatus"]) {
		const tbl = base.getTableByNameIfExists(tableName);
		if (!tbl) continue;
		const records = await tbl.selectRecordsAsync();
		const ids = new Set<string>();
		for (const r of records.records) {
			const atId = r.getCellValueAsString("@id");
			if (!atId) continue;
			const linked = r.getCellValue("forOrganizationProfile") as { id: string; name: string }[] | null;
			if (!linked?.length) continue;
			const parentAtId = linked[0]?.name;
			if (parentAtId && orgProfileIds.has(parentAtId)) ids.add(atId);
		}
		otherIds.set(tableName, ids);
	}

	// TeamProfile — forward traversal from OrganizationProfile via hasManagementTeamProfile
	// and hasBoardProfile link fields. This replaces the previous pass-through in
	// isRecordInScope which was leaking all TeamProfiles regardless of org.
	const teamProfileIds = new Set<string>();
	const orgProfileTbl = base.getTableByNameIfExists("OrganizationProfile");
	if (orgProfileTbl) {
		const orgProfileRecords = await orgProfileTbl.selectRecordsAsync();
		for (const r of orgProfileRecords.records) {
			const profileAtId = r.getCellValueAsString("@id");
			if (!profileAtId || !orgProfileIds.has(profileAtId)) continue;
			for (const linkField of ["hasManagementTeamProfile", "hasBoardProfile"]) {
				const linked = r.getCellValue(linkField) as { id: string; name: string }[] | null;
				if (!linked?.length) continue;
				for (const lnk of linked) {
					if (lnk.name) teamProfileIds.add(lnk.name);
				}
			}
		}
	}
	otherIds.set("TeamProfile", teamProfileIds);

	// EDGProfile — forward traversal from in-scope TeamProfiles via hasEDGProfile
	const edgProfileIds = new Set<string>();
	const teamProfileTbl = base.getTableByNameIfExists("TeamProfile");
	if (teamProfileTbl && teamProfileIds.size > 0) {
		const teamProfileRecords = await teamProfileTbl.selectRecordsAsync();
		for (const r of teamProfileRecords.records) {
			const tpAtId = r.getCellValueAsString("@id");
			if (!tpAtId || !teamProfileIds.has(tpAtId)) continue;
			const linked = r.getCellValue("hasEDGProfile") as { id: string; name: string }[] | null;
			if (!linked?.length) continue;
			for (const lnk of linked) {
				if (lnk.name) edgProfileIds.add(lnk.name);
			}
		}
	}
	otherIds.set("EDGProfile", edgProfileIds);

	return {
		indicatorReportIds: survivingIRIds,
		indicatorIds: survivingIndicatorIds,
		outcomeIds: survivingOutcomeIds,
		organizationIds: orgIdSet,
		themeIds: survivingThemeIds,
		otherIds,
	};
}

/**
 * Returns whether a record should be included in the scoped export.
 * Pass scope=null for full-base export (everything passes).
 */
export function isRecordInScope(
	scope: ExportScope | null,
	tableName: string,
	recordAtId: string
): boolean {
	if (!scope) return true;

	switch (tableName) {
		case "Organization":
			return scope.organizationIds.has(recordAtId);
		case "Outcome":
			return scope.outcomeIds.has(recordAtId);
		case "Indicator":
			return scope.indicatorIds.has(recordAtId);
		case "IndicatorReport":
			return scope.indicatorReportIds.has(recordAtId);
		case "Theme":
			return scope.themeIds.has(recordAtId);
		default: {
			const ids = scope.otherIds.get(tableName);
			// Tables not tracked in otherIds (e.g. codelists) pass through —
			// the existing codelist guard in export.ts handles them.
			if (!ids) return true;
			return ids.has(recordAtId);
		}
	}
}
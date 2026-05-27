import Base from "@airtable/blocks/dist/types/src/models/base";
import { Button, Dialog, Loader, Text } from "@airtable/blocks/ui";
import React, { useCallback, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { useDialog } from "../context/DialogContext";
import { buildExportData, exportData } from "../export/export";

interface OrgOption {
	recordId: string;
	orgId: string;
	hasLegalName: string;
	irCount: number;
}

type Step = "orgs" | "years" | "review" | "filename";

interface ExportDialogProps {
	base: Base;
	isDialogOpen: boolean;
	setDialogOpen: (isOpen: boolean) => void;
	setIsLoading: (isLoading: boolean) => void;
}

const CODELIST_PREFIXES = [
	"https://codelist.commonapproach.org/",
	"https://metadata.un.org/",
	"https://ontology.commonapproach.org/cids#",
];

function isCodelistOrg(orgId: string): boolean {
	return CODELIST_PREFIXES.some((prefix) => orgId.startsWith(prefix));
}

// Strip HTML tags for plain-text display inside the wizard
function stripHtml(s: string): string {
	return s.replace(/<[^>]*>/g, "");
}

// ─── Checkbox row ─────────────────────────────────────────────────────────────
function CheckRow({
	label,
	sublabel,
	checked,
	onChange,
}: {
	label: string;
	sublabel?: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<label
			style={{
				display: "flex",
				alignItems: "flex-start",
				gap: 12,
				padding: "10px 4px",
				cursor: "pointer",
				borderBottom: "1px solid #f0f0f0",
			}}
		>
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				style={{ marginTop: 2, flexShrink: 0, width: 16, height: 16 }}
			/>
			<div>
				<div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a" }}>{label}</div>
				{sublabel && (
					<div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{sublabel}</div>
				)}
			</div>
		</label>
	);
}

// ─── Select-all row ───────────────────────────────────────────────────────────
function SelectAllRow({
	label,
	total,
	selected,
	onSelectAll,
	onDeselectAll,
}: {
	label: string;
	total: number;
	selected: number;
	onSelectAll: () => void;
	onDeselectAll: () => void;
}) {
	const allChecked = selected === total && total > 0;
	return (
		<label
			style={{
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "10px 4px",
				cursor: "pointer",
				borderBottom: "2px solid #e0e0e0",
				marginBottom: 4,
			}}
		>
			<input
				type="checkbox"
				checked={allChecked}
				onChange={(e) => (e.target.checked ? onSelectAll() : onDeselectAll())}
				style={{ flexShrink: 0, width: 16, height: 16 }}
			/>
			<span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", flex: 1 }}>{label}</span>
		</label>
	);
}

// ─── Nav row ──────────────────────────────────────────────────────────────────
function NavRow({
	onClose,
	onBack,
	onNext,
	nextLabel,
	nextDisabled,
}: {
	onClose?: () => void;
	onBack?: () => void;
	onNext: () => void;
	nextLabel: string;
	nextDisabled?: boolean;
}) {
	return (
		<div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
			{onClose && (
				<Button onClick={onClose} variant="default">
					Close
				</Button>
			)}
			{onBack && (
				<Button onClick={onBack} variant="default">
					Back
				</Button>
			)}
			<Button
				onClick={onNext}
				disabled={nextDisabled}
				style={{
					backgroundColor: nextDisabled ? "#ccc" : "#1a56db",
					color: "#fff",
					border: "none",
					fontWeight: 600,
					cursor: nextDisabled ? "not-allowed" : "pointer",
					minWidth: 80,
				}}
			>
				{nextLabel}
			</Button>
		</div>
	);
}

// ─── Warning list ─────────────────────────────────────────────────────────────
function WarningList({
	title,
	items,
	color,
	icon,
}: {
	title: string;
	items: string[];
	color: string;
	icon: string;
}) {
	if (!items.length) return null;
	return (
		<div style={{ marginBottom: 12 }}>
			<div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
				<span>{icon}</span>
				<span style={{ fontWeight: 700, fontSize: 14, color }}>{title}</span>
			</div>
			<div style={{ maxHeight: 160, overflowY: "auto" }}>
				{items.map((w, i) => (
					<div
						key={i}
						style={{
							fontSize: 13,
							color: "#333",
							padding: "5px 0",
							borderBottom: i < items.length - 1 ? "1px solid #f0f0f0" : "none",
						}}
					>
						{w}
					</div>
				))}
			</div>
		</div>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────
const ExportDialog: React.FC<ExportDialogProps> = ({
	base,
	isDialogOpen,
	setDialogOpen,
	setIsLoading,
}) => {
	const { setDialogContent } = useDialog();
	const intl = useIntl();

	const [step, setStep] = useState<Step>("orgs");
	const [loading, setLoading] = useState(false);

	// Step 1 — orgs
	const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
	const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set());

	// Step 2 — years
	const [yearOptions, setYearOptions] = useState<number[]>([]);
	const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set());

	// Step 3 — review
	const [effectiveOrgs, setEffectiveOrgs] = useState<OrgOption[]>([]);
	const [effectiveIrCount, setEffectiveIrCount] = useState(0);
	const [scopeWarnings, setScopeWarnings] = useState<string[]>([]);
	const [validatorErrors, setValidatorErrors] = useState<string[]>([]);
	const [validatorWarnings, setValidatorWarnings] = useState<string[]>([]);

	// Step 4 — filename
	const [fileName, setFileName] = useState("");

	// ── Reset on open ─────────────────────────────────────────────────────────
	useEffect(() => {
		if (!isDialogOpen) return;
		setStep("orgs");
		setOrgOptions([]);
		setSelectedOrgIds(new Set());
		setYearOptions([]);
		setSelectedYears(new Set());
		setEffectiveOrgs([]);
		setEffectiveIrCount(0);
		setScopeWarnings([]);
		setValidatorErrors([]);
		setValidatorWarnings([]);
		setFileName("");
		loadOrgs();
	}, [isDialogOpen]);

	// ── Step 1: orgs with ≥1 IR ───────────────────────────────────────────────
	const loadOrgs = useCallback(async () => {
		setLoading(true);
		try {
			const orgTable = base.getTableByNameIfExists("Organization");
			const irTable = base.getTableByNameIfExists("IndicatorReport");
			if (!orgTable || !irTable) return;

			const [orgRecords, irRecords] = await Promise.all([
				orgTable.selectRecordsAsync(),
				irTable.selectRecordsAsync(),
			]);

			const irCountByOrgAtId = new Map<string, number>();
			const orgAirtableIdToAtId = new Map<string, string>();
			for (const r of orgRecords.records) {
				const atId = r.getCellValueAsString("@id");
				if (atId) orgAirtableIdToAtId.set(r.id, atId);
			}
			for (const ir of irRecords.records) {
				const linked = ir.getCellValue("forOrganization") as { id: string }[] | null;
				if (!linked?.length) continue;
				const orgAtId = orgAirtableIdToAtId.get(linked[0].id);
				if (!orgAtId) continue;
				irCountByOrgAtId.set(orgAtId, (irCountByOrgAtId.get(orgAtId) ?? 0) + 1);
			}

			const options: OrgOption[] = orgRecords.records
				.filter((r) => {
					const orgId = r.getCellValueAsString("@id");
					return orgId && !isCodelistOrg(orgId) && irCountByOrgAtId.has(orgId);
				})
				.map((r) => ({
					recordId: r.id,
					orgId: r.getCellValueAsString("@id"),
					hasLegalName:
						r.getCellValueAsString("hasLegalName") || r.getCellValueAsString("@id"),
					irCount: irCountByOrgAtId.get(r.getCellValueAsString("@id")) ?? 0,
				}))
				.sort((a, b) => a.hasLegalName.localeCompare(b.hasLegalName));

			setOrgOptions(options);
			setSelectedOrgIds(new Set(options.map((o) => o.orgId)));
		} finally {
			setLoading(false);
		}
	}, [base]);

	// ── Step 2: years from selected orgs ─────────────────────────────────────
	const loadYears = useCallback(async () => {
		setLoading(true);
		try {
			const orgTable = base.getTableByNameIfExists("Organization");
			const irTable = base.getTableByNameIfExists("IndicatorReport");
			if (!orgTable || !irTable) return;

			const [orgRecords, irRecords] = await Promise.all([
				orgTable.selectRecordsAsync(),
				irTable.selectRecordsAsync(),
			]);

			const orgAirtableIdToAtId = new Map<string, string>();
			for (const r of orgRecords.records) {
				orgAirtableIdToAtId.set(r.id, r.getCellValueAsString("@id"));
			}

			const years = new Set<number>();
			for (const ir of irRecords.records) {
				const linked = ir.getCellValue("forOrganization") as { id: string }[] | null;
				if (!linked?.length) continue;
				const orgAtId = orgAirtableIdToAtId.get(linked[0].id);
				if (!orgAtId || !selectedOrgIds.has(orgAtId)) continue;
				const endedRaw = ir.getCellValue("endedAtTime") as string | null;
				if (endedRaw) {
					const d = new Date(endedRaw);
					if (!isNaN(d.getFullYear())) years.add(d.getFullYear());
				}
			}

			const sortedYears = Array.from(years).sort((a, b) => b - a);
			setYearOptions(sortedYears);
			setSelectedYears(new Set(sortedYears));
		} finally {
			setLoading(false);
		}
	}, [base, selectedOrgIds]);

	// ── Step 3: effective orgs × years + run validator ────────────────────────
	const loadReview = useCallback(async () => {
		setLoading(true);
		try {
			const orgTable = base.getTableByNameIfExists("Organization");
			const irTable = base.getTableByNameIfExists("IndicatorReport");
			if (!orgTable || !irTable) return;

			const [orgRecords, irRecords] = await Promise.all([
				orgTable.selectRecordsAsync(),
				irTable.selectRecordsAsync(),
			]);

			const orgAirtableIdToAtId = new Map<string, string>();
			for (const r of orgRecords.records) {
				orgAirtableIdToAtId.set(r.id, r.getCellValueAsString("@id"));
			}

			const irCountByOrgInYears = new Map<string, number>();
			for (const ir of irRecords.records) {
				const linked = ir.getCellValue("forOrganization") as { id: string }[] | null;
				if (!linked?.length) continue;
				const orgAtId = orgAirtableIdToAtId.get(linked[0].id);
				if (!orgAtId || !selectedOrgIds.has(orgAtId)) continue;
				const endedRaw = ir.getCellValue("endedAtTime") as string | null;
				if (!endedRaw) continue;
				const year = new Date(endedRaw).getFullYear();
				if (!selectedYears.has(year)) continue;
				irCountByOrgInYears.set(orgAtId, (irCountByOrgInYears.get(orgAtId) ?? 0) + 1);
			}

			const effective = orgOptions.filter(
				(o) => selectedOrgIds.has(o.orgId) && irCountByOrgInYears.has(o.orgId)
			);
			const totalIrs = Array.from(irCountByOrgInYears.values()).reduce((a, b) => a + b, 0);

			const orgsExcluded = orgOptions.filter(
				(o) => selectedOrgIds.has(o.orgId) && !irCountByOrgInYears.has(o.orgId)
			);
			const sWarns = orgsExcluded.map(
				(o) =>
					`${o.hasLegalName} has no indicator reports in the selected year(s) and will be excluded from the export.`
			);

			setEffectiveOrgs(effective);
			setEffectiveIrCount(totalIrs);
			setScopeWarnings(sWarns);

			// Run full validator on the scoped data so quality warnings appear now
			if (effective.length > 0) {
				const effectiveOrgIds = effective.map((o) => o.orgId);
				const { errors, warnings } = await buildExportData(
					base,
					intl,
					effectiveOrgIds,
					Array.from(selectedYears)
				);
				setValidatorErrors(errors.map(stripHtml));
				setValidatorWarnings(warnings.map(stripHtml));
			} else {
				setValidatorErrors([]);
				setValidatorWarnings([]);
			}
		} finally {
			setLoading(false);
		}
	}, [base, intl, selectedOrgIds, selectedYears, orgOptions]);

	// ── Default filename ──────────────────────────────────────────────────────
	const buildDefaultFileName = useCallback(() => {
		const date = new Date();
		const dateSuffix = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
		if (effectiveOrgs.length === 1) {
			return `CIDSBasic${effectiveOrgs[0].hasLegalName.replace(/[^\w]/gi, "").slice(0, 40)}${dateSuffix}`;
		}
		return `CIDSBasicMultipleOrgs${dateSuffix}`;
	}, [effectiveOrgs]);

	// ── Export ────────────────────────────────────────────────────────────────
	const handleExport = async () => {
		const effectiveOrgIds = effectiveOrgs.map((o) => o.orgId);
		if (!effectiveOrgIds.length) return;

		const cleanedName = fileName.replace(/[^\w]/gi, "") || buildDefaultFileName();

		setDialogOpen(false);
		try {
			setIsLoading(true);
			await exportData(
				base,
				setDialogContent,
				cleanedName,
				intl,
				effectiveOrgIds,
				Array.from(selectedYears),
				true // warnings already shown in wizard — skip interstitial dialog
			);
		} catch (error) {
			setDialogContent(
				intl.formatMessage({ id: "generics.error", defaultMessage: "Error" }),
				error.message ||
					intl.formatMessage({
						id: "generics.error.message",
						defaultMessage: "Something went wrong",
					}),
				true
			);
		} finally {
			setIsLoading(false);
		}
	};

	if (!isDialogOpen) return null;

	const sortedSelectedYears = Array.from(selectedYears).sort((a, b) => a - b);
	const hasAnyWarnings =
		scopeWarnings.length > 0 || validatorWarnings.length > 0 || validatorErrors.length > 0;

	// ── Render ────────────────────────────────────────────────────────────────
	return (
		<Dialog onClose={() => setDialogOpen(false)} width="480px">
			<Dialog.CloseButton />

			{/* ── Step 1: Select Organisations ── */}
			{step === "orgs" && (
				<>
					<Text style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
						Select Organizations
					</Text>
					<Text style={{ fontSize: 14, color: "#444", marginBottom: 16 }}>
						Select the organization(s) to export. Only organizations with at least one
						indicator report are listed.
					</Text>

					{loading ? (
						<div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
							<Loader scale={0.4} />
						</div>
					) : orgOptions.length === 0 ? (
						<Text style={{ color: "#888", fontSize: 13 }}>
							No organisations with impact reports found.
						</Text>
					) : (
						<div style={{ maxHeight: 340, overflowY: "auto" }}>
							<SelectAllRow
								label="Select all organizations"
								total={orgOptions.length}
								selected={selectedOrgIds.size}
								onSelectAll={() =>
									setSelectedOrgIds(new Set(orgOptions.map((o) => o.orgId)))
								}
								onDeselectAll={() => setSelectedOrgIds(new Set())}
							/>
							{orgOptions.map((org) => (
								<CheckRow
									key={org.orgId}
									label={`${org.hasLegalName} (${org.irCount} report${org.irCount !== 1 ? "s" : ""})`}
									checked={selectedOrgIds.has(org.orgId)}
									onChange={(checked) => {
										const next = new Set(selectedOrgIds);
										checked ? next.add(org.orgId) : next.delete(org.orgId);
										setSelectedOrgIds(next);
									}}
								/>
							))}
						</div>
					)}

					{selectedOrgIds.size === 0 && orgOptions.length > 0 && (
						<Text style={{ fontSize: 13, color: "#888", marginTop: 10, fontStyle: "italic" }}>
							Select at least one organisation to continue.
						</Text>
					)}

					<NavRow
						onClose={() => setDialogOpen(false)}
						onNext={() => {
							setStep("years");
							loadYears();
						}}
						nextLabel="Next"
						nextDisabled={selectedOrgIds.size === 0 || loading}
					/>
				</>
			)}

			{/* ── Step 2: Select Years ── */}
			{step === "years" && (
				<>
					<Text style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
						Select Years
					</Text>
					<Text style={{ fontSize: 14, color: "#444", marginBottom: 16 }}>
						Select the reporting year(s) to include. Indicator reports outside these
						years will be excluded.
					</Text>

					{loading ? (
						<div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
							<Loader scale={0.4} />
						</div>
					) : yearOptions.length === 0 ? (
						<Text style={{ color: "#888", fontSize: 13 }}>
							No reporting years found for the selected organisations.
						</Text>
					) : (
						<div style={{ maxHeight: 340, overflowY: "auto" }}>
							<SelectAllRow
								label="All years"
								total={yearOptions.length}
								selected={selectedYears.size}
								onSelectAll={() => setSelectedYears(new Set(yearOptions))}
								onDeselectAll={() => setSelectedYears(new Set())}
							/>
							{yearOptions.map((year) => (
								<CheckRow
									key={year}
									label={String(year)}
									checked={selectedYears.has(year)}
									onChange={(checked) => {
										const next = new Set(selectedYears);
										checked ? next.add(year) : next.delete(year);
										setSelectedYears(next);
									}}
								/>
							))}
						</div>
					)}

					{selectedYears.size > 0 && (
						<Text
							style={{ fontSize: 13, color: "#1a56db", marginTop: 10, fontStyle: "italic" }}
						>
							Indicator reports for {sortedSelectedYears.join(", ")} selected.
						</Text>
					)}

					<NavRow
						onClose={() => setDialogOpen(false)}
						onBack={() => setStep("orgs")}
						onNext={() => {
							setStep("review");
							loadReview();
						}}
						nextLabel="Next"
						nextDisabled={selectedYears.size === 0 || loading}
					/>
				</>
			)}

			{/* ── Step 3: Review ── */}
			{step === "review" && (
				<>
					<Text style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
						Review & Export
					</Text>
					<Text style={{ fontSize: 14, color: "#444", marginBottom: 16 }}>
						The following data will be exported:
					</Text>

					{loading ? (
						<div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
							<Loader scale={0.4} />
						</div>
					) : (
						<>
							{/* Summary */}
							<div style={{ marginBottom: 16 }}>
								<div style={{ fontSize: 14, marginBottom: 6 }}>
									<span style={{ fontWeight: 700 }}>
										{effectiveOrgs.length} organization
										{effectiveOrgs.length !== 1 ? "s" : ""}:
									</span>{" "}
									{effectiveOrgs.map((o) => o.hasLegalName).join(", ")}
								</div>
								<div style={{ fontSize: 14, marginBottom: 6 }}>
									<span style={{ fontWeight: 700 }}>Years:</span>{" "}
									{sortedSelectedYears.join(", ")}
								</div>
								<div style={{ fontSize: 14 }}>
									<span style={{ fontWeight: 700 }}>
										{effectiveIrCount} indicator report
										{effectiveIrCount !== 1 ? "s" : ""}
									</span>
								</div>
							</div>

							{/* Warnings section */}
							{hasAnyWarnings && (
								<div
									style={{
										borderTop: "1px solid #e8e8e8",
										paddingTop: 12,
										maxHeight: 280,
										overflowY: "auto",
									}}
								>
									<WarningList
										title="Errors"
										items={validatorErrors}
										color="#c00000"
										icon="🔴"
									/>
									<WarningList
										title="Scope Warnings"
										items={scopeWarnings}
										color="#b45309"
										icon="⚠️"
									/>
									<WarningList
										title="Data Warnings"
										items={validatorWarnings}
										color="#b45309"
										icon="⚠️"
									/>
								</div>
							)}

							{effectiveOrgs.length === 0 && (
								<Text style={{ fontSize: 13, color: "#c00", marginTop: 8 }}>
									No organisations have indicator reports for the selected year(s).
									Please go back and adjust your selection.
								</Text>
							)}
						</>
					)}

					<NavRow
						onClose={() => setDialogOpen(false)}
						onBack={() => setStep("years")}
						onNext={() => {
							setFileName(buildDefaultFileName());
							setStep("filename");
						}}
						nextLabel={
							validatorErrors.length > 0
								? "Continue with Errors"
								: hasAnyWarnings
									? "Continue Anyway"
									: "Continue"
						}
						nextDisabled={loading || effectiveOrgs.length === 0}
					/>
				</>
			)}

			{/* ── Step 4: Name your file ── */}
			{step === "filename" && (
				<>
					<Text style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
						Name Your Export
					</Text>
					<Text style={{ fontSize: 14, color: "#444", marginBottom: 16 }}>
						Enter a name for the exported file. It will be saved as a{" "}
						<span style={{ fontWeight: 600 }}>.json</span> file.
					</Text>

					<input
						value={fileName}
						onChange={(e) => setFileName(e.target.value)}
						placeholder="Enter file name"
						style={{
							width: "100%",
							padding: "8px 10px",
							fontSize: 14,
							border: "1px solid #d0d0d0",
							borderRadius: 6,
							boxSizing: "border-box",
							outline: "none",
						}}
					/>

					{/* Mini summary */}
					<div
						style={{
							marginTop: 12,
							padding: "10px 12px",
							background: "#f5f8ff",
							border: "1px solid #d0e2ff",
							borderRadius: 6,
							fontSize: 13,
							color: "#444",
						}}
					>
						<div style={{ marginBottom: 4 }}>
							<span style={{ fontWeight: 600 }}>{effectiveOrgs.length}</span> org
							{effectiveOrgs.length !== 1 ? "s" : ""}:{" "}
							{effectiveOrgs.map((o) => o.hasLegalName).join(", ")}
						</div>
						<div style={{ marginBottom: 4 }}>
							<span style={{ fontWeight: 600 }}>Years:</span>{" "}
							{sortedSelectedYears.join(", ")}
						</div>
						<div>
							<span style={{ fontWeight: 600 }}>{effectiveIrCount}</span> indicator
							report{effectiveIrCount !== 1 ? "s" : ""}
						</div>
					</div>

					<NavRow
						onClose={() => setDialogOpen(false)}
						onBack={() => setStep("review")}
						onNext={handleExport}
						nextLabel="Export"
						nextDisabled={!fileName.trim()}
					/>
				</>
			)}
		</Dialog>
	);
};

export default ExportDialog;
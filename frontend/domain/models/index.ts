import { Indicator } from "./Indicator";
import { IndicatorReport } from "./IndicatorReport";
import { Organization } from "./Organization";
import { Outcome } from "./Outcome";
import { Theme } from "./Theme";

export const map = {
	Organization: Organization,
	Theme: Theme,
	Outcome: Outcome,
	Indicator: Indicator,
	IndicatorReport: IndicatorReport,
};

export type ModelType = keyof typeof map;

export const ignoredFields = {
	Theme: ["hasOutcome"],
	Outcome: ["forOrganization"],
	Indicator: ["forOrganization", "forOutcome"],
};

export * from "./Indicator";
export * from "./IndicatorReport";
export * from "./Organization";
export * from "./Outcome";
export * from "./Theme";

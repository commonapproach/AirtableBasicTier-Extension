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

export * from "./Organization";
export * from "./Theme";
export * from "./Outcome";
export * from "./Indicator";
export * from "./IndicatorReport";

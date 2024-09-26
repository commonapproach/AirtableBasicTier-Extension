import { Address } from "./Address";
import { Characteristic } from "./Characteristic";
import { EDGProfile } from "./EDGProfile";
import { EquityDeservingGroup } from "./EquityDeservingGroup";
import { FundingState } from "./FundingState";
import { FundingStatus } from "./FundingStatus";
import { Indicator } from "./Indicator";
import { IndicatorReport } from "./IndicatorReport";
import { Locality } from "./Locality";
import { Organization } from "./Organization";
import { OrganizationProfile } from "./OrganizationProfile";
import { OrganizationType } from "./OrganizationType";
import { Outcome } from "./Outcome";
import { Person } from "./Person";
import { PopulationServed } from "./PopulationServed";
import { ProvinceTerritory } from "./ProvinceTerritory";
import { Sector } from "./Sector";
import { TeamProfile } from "./TeamProfile";
import { Theme } from "./Theme";

export const map = {
	Organization: Organization,
	Theme: Theme,
	Outcome: Outcome,
	Indicator: Indicator,
	IndicatorReport: IndicatorReport,
	Address: Address,
};

export const mapSFFModel = {
	OrganizationProfile: OrganizationProfile,
	FundingStatus: FundingStatus,
	TeamProfile: TeamProfile,
	EDGProfile: EDGProfile,
	EquityDeservingGroup: EquityDeservingGroup,
	Person: Person,
	Characteristic: Characteristic,
	FundingState: FundingState,
	Sector: Sector,
	Locality: Locality,
	ProvinceTerritory: ProvinceTerritory,
	OrganizationType: OrganizationType,
	PopulationServed: PopulationServed,
};

export type ModelType = keyof typeof map;

export type SFFModelType = keyof typeof mapSFFModel;

export const ignoredFields = {
	Organization: ["hasOrganizationProfile", "hasFundingStatus"],
	Theme: ["hasOutcome"],
	Address: ["forOrganization"],
	Person: ["forOrganizationProfile"],
	TeamProfile: ["forOrganizationProfileManagementTeam", "forOrganizationProfileBoard"],
	EquityDeservingGroup: ["forOrganizationProfile", "hasEDGProfile"],
	FundingStatus: ["forOrganizationProfile"],
	Characteristic: ["forEquityDeservingGroup"],
	EDGProfile: ["forTeamProfile"],
	FundingState: ["forFundingStatus"],
	Sector: ["forOrganizationProfile"],
	Locality: ["forOrganizationProfile"],
	ProvinceTerritory: ["forOrganizationProfile"],
	OrganizationType: ["forOrganizationProfile"],
	PopulationServed: ["forOrganizationProfile"],
};

export const predefinedCodeLists = [
	"Sector",
	"Locality",
	"PopulationServed",
	"ProvinceTerritory",
	"OrganizationType",
];

export * from "./Address";
export * from "./Indicator";
export * from "./IndicatorReport";
export * from "./Organization";
export * from "./Outcome";
export * from "./Theme";

// Export SFF module classes
export * from "./Characteristic";
export * from "./EDGProfile";
export * from "./EquityDeservingGroup";
export * from "./FundingState";
export * from "./FundingStatus";
export * from "./Locality";
export * from "./OrganizationProfile";
export * from "./OrganizationType";
export * from "./Person";
export * from "./PopulationServed";
export * from "./ProvinceTerritory";
export * from "./Sector";
export * from "./TeamProfile";

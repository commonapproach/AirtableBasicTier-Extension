import { Base } from "./Base";
import { IndicatorReport } from "./IndicatorReport";
import { Organization } from "./Organization";
import { Outcome } from "./Outcome";
import { Theme } from "./Theme";

export class Indicator extends Base {
	static className: string = "Indicator";

	constructor() {
		super();
		this._fields = [
			{
				name: "@id",
				type: "string",
				representedType: "string",
				primary: true,
				unique: true,
				notNull: true,
				required: true,
				semiRequired: false,
			},
			{
				name: "org:hasName",
				displayName: "hasName",
				type: "string",
				representedType: "string",
				unique: true,
				notNull: true,
				required: true,
				semiRequired: false,
			},
			{
				name: "hasDescription",
				type: "text",
				representedType: "string",
				defaultValue: "",
				unique: false,
				notNull: false,
				required: false,
				semiRequired: false,
			},
			{
				name: "i72:unit_of_measure",
				displayName: "unit_of_measure",
				type: "string",
				representedType: "string",
				defaultValue: "",
				unique: false,
				notNull: true,
				required: false,
				semiRequired: true,
			},
			{
				name: "forOrganization",
				type: "link",
				representedType: "string",
				defaultValue: "",
				link: { table: Organization, field: "hasIndicator" },
				unique: false,
				notNull: false,
				required: false,
				semiRequired: true,
			},
			{
				name: "forOutcome",
				type: "link",
				representedType: "string",
				defaultValue: "",
				link: { table: Outcome, field: "hasIndicator" },
				unique: false,
				notNull: false,
				required: false,
				semiRequired: true,
			},
			{
				name: "forTheme",
				type: "link",
				representedType: "array",
				defaultValue: [],
				link: { table: Theme, field: "hasIndicator" },
				unique: false,
				notNull: false,
				required: false,
				semiRequired: true,
			},
			{
				name: "hasIndicatorReport",
				type: "link",
				representedType: "array",
				defaultValue: [],
				link: { table: IndicatorReport, field: "forIndicator" },
				unique: false,
				notNull: false,
				required: false,
				semiRequired: false,
			},
		];
	}
}

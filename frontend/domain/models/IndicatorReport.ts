import { Base } from "./Base";
import { Indicator } from "./Indicator";
import { Organization } from "./Organization";

export class IndicatorReport extends Base {
	static className: string = "IndicatorReport";

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
				name: "hasName",
				type: "string",
				representedType: "string",
				unique: false,
				notNull: true,
				required: true,
				semiRequired: false,
			},
			{
				name: "hasComment",
				type: "string",
				representedType: "string",
				defaultValue: "",
				unique: false,
				notNull: false,
				required: false,
				semiRequired: false,
			},
			{
				name: "value",
				displayName: "i72:value",
				type: "object",
				objectType: "i72:Measure",
				representedType: "object",
				properties: [
					{
						name: "hasNumericalValue",
						displayName: "value",
						type: "string",
						representedType: "string",
						defaultValue: "",
						unique: false,
						notNull: false,
						required: false,
						semiRequired: false,
					},
				],
				defaultValue: {
					hasNumericalValue: "",
					unit_of_measure: "",
				},
				unique: false,
				notNull: true,
				required: true,
				semiRequired: false,
			},
			{
				name: "startedAtTime",
				displayName: "startedAtTime",
				type: "datetime",
				representedType: "string",
				defaultValue: "",
				unique: false,
				notNull: true,
				required: false,
				semiRequired: true,
			},
			{
				name: "endedAtTime",
				displayName: "endedAtTime",
				type: "datetime",
				representedType: "string",
				defaultValue: "",
				unique: false,
				notNull: true,
				required: false,
				semiRequired: true,
			},
			{
				name: "forIndicator",
				type: "link",
				representedType: "string",
				defaultValue: "",
				link: { table: Indicator, field: "hasIndicatorReport" },
				unique: false,
				notNull: false,
				required: false,
				semiRequired: true,
			},
			{
				name: "forOrganization",
				type: "link",
				representedType: "string",
				defaultValue: "",
				link: { table: Organization, field: "hasIndicatorReport" },
				unique: false,
				notNull: false,
				required: true,
				semiRequired: false,
			},
		];
	}
}

import { Base } from "./Base";
import { Indicator } from "./Indicator";

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
				unique: true,
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
				name: "i72:value",
				type: "object",
				objectType: "i72:Measure",
				representedType: "object",
				properties: [
					{
						name: "i72:numerical_value",
						displayName: "value",
						type: "string",
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
						notNull: false,
						required: false,
						semiRequired: false,
					},
				],
				defaultValue: {
					"i72:numerical_value": "",
					"i72:unit_of_measure": "",
				},
				unique: false,
				notNull: true,
				required: true,
				semiRequired: false,
			},
			{
				name: "time:hasTime",
				type: "object",
				objectType: "time:DateTimeInterval",
				representedType: "object",
				properties: [
					{
						name: "time:hasBeginning",
						type: "object",
						objectType: "time:Instant",
						representedType: "object",
						properties: [
							{
								name: "time:inXSDDateTimeStamp",
								displayName: "hasBeginning",
								type: "datetime",
								representedType: "string",
								defaultValue: "",
								unique: false,
								notNull: false,
								required: false,
								semiRequired: false,
							},
						],
						defaultValue: {
							"time:inXSDDateTimeStamp": "",
						},
						unique: false,
						notNull: false,
						required: false,
						semiRequired: false,
					},
					{
						name: "time:hasEnd",
						type: "object",
						objectType: "time:Instant",
						representedType: "object",
						properties: [
							{
								name: "time:inXSDDateTimeStamp",
								displayName: "hasEnd",
								type: "datetime",
								representedType: "string",
								defaultValue: "",
								unique: false,
								notNull: false,
								required: false,
								semiRequired: false,
							},
						],
						defaultValue: {
							"time:inXSDDateTimeStamp": "",
						},
						unique: false,
						notNull: false,
						required: false,
						semiRequired: false,
					},
				],
				defaultValue: {
					"time:hasBeginning": {
						"@context": "http://ontology.eil.utoronto.ca/cids/contexts/cidsContext.json",
						"@type": "time:Instant",
						"time:inXSDDateTimeStamp": "",
					},
					"time:hasEnd": {
						"@context": "http://ontology.eil.utoronto.ca/cids/contexts/cidsContext.json",
						"@type": "time:Instant",
						"time:inXSDDateTimeStamp": "",
					},
				},
				unique: false,
				notNull: true,
				required: true,
				semiRequired: false,
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
		];
	}
}
